import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { wsClient, WsMessage } from '../services/ws';
import { saveMessage, getMessages, LocalMessage } from '../services/localDb';
import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  generateAesKey,
  encrypt,
  decrypt,
  wrapAesKey,
  unwrapAesKey,
  EncryptedPayload,
} from '../services/crypto';
import UserList from '../components/UserList';
import MessageList, { Message } from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import PrivatePanel from '../components/PrivatePanel';
import styles from './Chat.module.css';

interface OnlineUser {
  id: string;
  username: string;
}

interface Props {
  userId: string;
  username: string;
  onLogout: () => void;
}

export default function Chat({ userId, username, onLogout }: Props) {
  const navigate = useNavigate();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [hallMessages, setHallMessages] = useState<Message[]>([]);
  const [hallTyping, setHallTyping] = useState<string[]>([]);
  const [privateMessages, setPrivateMessages] = useState<Message[]>([]);
  const [privateTyping, setPrivateTyping] = useState<string[]>([]);
  const [activePeerId, setActivePeerId] = useState<string | null>(null);
  const [activePeerUsername, setActivePeerUsername] = useState('');

  const myKeyPair = useRef<CryptoKeyPair | null>(null);
  const hallKey = useRef<CryptoKey | null>(null);
  const sessionKeys = useRef<Map<string, CryptoKey>>(new Map());
  const usernameMap = useRef<Map<string, string>>(new Map([[userId, username]]));

  const getSessionKey = useCallback(async (peerId: string): Promise<CryptoKey | null> => {
    if (sessionKeys.current.has(peerId)) return sessionKeys.current.get(peerId)!;
    if (!myKeyPair.current) return null;
    try {
      const { key_data } = await api.getPubkey(peerId);
      const peerPubKey = await importPublicKey(key_data);
      const sharedKey = await deriveSharedKey(myKeyPair.current.privateKey, peerPubKey);
      sessionKeys.current.set(peerId, sharedKey);
      return sharedKey;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function init() {
      const keyPair = await generateKeyPair();
      myKeyPair.current = keyPair;
      const pubKeyB64 = await exportPublicKey(keyPair.publicKey);
      await api.uploadPubkey(pubKeyB64);

      const { token } = await api.getToken();
      wsClient.connect(token);

      const history = await getMessages('hall', 200);
      setHallMessages(history.map(m => ({
        id: m.id,
        from_id: m.from_id,
        from_username: usernameMap.current.get(m.from_id) || m.from_id,
        content: m.content,
        timestamp: m.timestamp,
      })));

      cleanup = wsClient.on(async (msg: WsMessage) => {
        if (msg.type === 'online_users' && msg.users) {
          const users = msg.users as OnlineUser[];
          users.forEach(u => usernameMap.current.set(u.id, u.username));
          setOnlineUsers(users);

          if (!hallKey.current) {
            const key = await generateAesKey();
            hallKey.current = key;
            for (const user of users) {
              if (user.id === userId) continue;
              const sessionKey = await getSessionKey(user.id);
              if (!sessionKey) continue;
              const wrapped = await wrapAesKey(key, sessionKey);
              wsClient.send({ type: 'hall_key_distribution', payload: { to: user.id, wrapped } });
            }
          }
        } else if (msg.type === 'user_joined') {
          const u = { id: msg.userId!, username: msg.username! };
          usernameMap.current.set(u.id, u.username);
          setOnlineUsers(prev => [...prev.filter(x => x.id !== u.id), u]);

          if (hallKey.current) {
            const sessionKey = await getSessionKey(u.id);
            if (sessionKey) {
              const wrapped = await wrapAesKey(hallKey.current, sessionKey);
              wsClient.send({ type: 'hall_key_distribution', payload: { to: u.id, wrapped } });
            }
          }
        } else if (msg.type === 'user_left') {
          setOnlineUsers(prev => prev.filter(u => u.id !== msg.userId));
        } else if (msg.type === 'hall_key_distribution') {
          if (!myKeyPair.current || !msg.from) return;
          const sessionKey = await getSessionKey(msg.from);
          if (!sessionKey) return;
          const wrapped = msg.payload?.wrapped as EncryptedPayload;
          hallKey.current = await unwrapAesKey(wrapped, sessionKey);
        } else if (msg.type === 'hall_message') {
          if (!hallKey.current || !msg.from || !msg.payload) return;
          const payload = msg.payload as unknown as EncryptedPayload;
          const content = await decrypt(payload, hallKey.current);
          const fromUsername = usernameMap.current.get(msg.from) || msg.from;
          const newMsg: Message = {
            id: `${msg.from}-${msg.timestamp}`,
            from_id: msg.from,
            from_username: fromUsername,
            content,
            timestamp: msg.timestamp!,
          };
          setHallMessages(prev => [...prev, newMsg]);
          await saveMessage({ ...newMsg, chat_id: 'hall' } as LocalMessage);
        } else if (msg.type === 'private_message') {
          if (!msg.from || !msg.payload) return;
          const peerId = msg.from === userId ? activePeerId || msg.from : msg.from;
          const sessionKey = await getSessionKey(peerId);
          if (!sessionKey) return;
          const payload = msg.payload as unknown as EncryptedPayload;
          const content = await decrypt(payload, sessionKey);
          const fromUsername = usernameMap.current.get(msg.from) || msg.from;
          const newMsg: Message = {
            id: `${msg.from}-${msg.timestamp}`,
            from_id: msg.from,
            from_username: fromUsername,
            content,
            timestamp: msg.timestamp!,
          };
          const chatId = [userId, peerId].sort().join('-');
          setPrivateMessages(prev => [...prev, newMsg]);
          await saveMessage({ ...newMsg, chat_id: chatId } as LocalMessage);
        } else if (msg.type === 'typing') {
          const fromUsername = usernameMap.current.get(msg.from || '') || msg.from || '';
          setHallTyping(prev => [...new Set([...prev, fromUsername])]);
          setTimeout(() => setHallTyping(prev => prev.filter(n => n !== fromUsername)), 3000);
        }
      });
    }

    init().catch(console.error);
    return () => {
      cleanup?.();
      wsClient.disconnect();
    };
  }, [userId, getSessionKey]);

  async function sendHallMessage(text: string) {
    if (!hallKey.current) return;
    const payload = await encrypt(text, hallKey.current);
    wsClient.send({ type: 'hall_message', payload });
  }

  async function sendPrivateMessage(text: string) {
    if (!activePeerId) return;
    const sessionKey = await getSessionKey(activePeerId);
    if (!sessionKey) return;
    const payload = await encrypt(text, sessionKey);
    wsClient.send({ type: 'private_message', payload: { to: activePeerId, ...payload } });
  }

  function sendTyping() {
    wsClient.send({ type: 'typing', payload: {} });
  }

  function sendPrivateTyping() {
    if (activePeerId) wsClient.send({ type: 'typing', payload: { to: activePeerId } });
  }

  async function selectUser(peerId: string) {
    if (peerId === userId) return;
    const peerName = usernameMap.current.get(peerId) || peerId;
    setActivePeerId(peerId);
    setActivePeerUsername(peerName);
    const chatId = [userId, peerId].sort().join('-');
    const history = await getMessages(chatId, 200);
    setPrivateMessages(history.map(m => ({
      id: m.id,
      from_id: m.from_id,
      from_username: usernameMap.current.get(m.from_id) || m.from_id,
      content: m.content,
      timestamp: m.timestamp,
    })));
  }

  async function handleLogout() {
    await api.logout();
    onLogout();
    navigate('/login');
  }

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logo}>江湖</span>
          <span className={styles.roomName}># 公共大厅</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.username}><span>{username}</span></span>
          <button className={styles.inviteBtn} onClick={() => navigate('/settings')}>邀请码</button>
          <button className={styles.logoutBtn} onClick={handleLogout}>退出</button>
        </div>
      </header>

      <aside className={styles.sidebar}>
        <UserList
          users={onlineUsers}
          currentUserId={userId}
          activePrivateId={activePeerId}
          onSelectUser={selectUser}
        />
      </aside>

      <main className={styles.main}>
        <MessageList
          messages={hallMessages}
          currentUserId={userId}
          typingUsernames={hallTyping}
        />
        <MessageInput
          onSend={sendHallMessage}
          onTyping={sendTyping}
          disabled={!hallKey.current}
          placeholder={hallKey.current ? '发言于大厅...' : '正在建立加密连接...'}
        />
      </main>

      <aside className={styles.private}>
        <PrivatePanel
          peerId={activePeerId}
          peerUsername={activePeerUsername}
          messages={privateMessages}
          currentUserId={userId}
          typingUsernames={privateTyping}
          onSend={sendPrivateMessage}
          onTyping={sendPrivateTyping}
          onClose={() => setActivePeerId(null)}
        />
      </aside>
    </div>
  );
}
