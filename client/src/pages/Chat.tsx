import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearTokens } from '../services/api';
import type { ServerMessage, AllUser } from '../services/api';
import { wsClient } from '../services/ws';
import type { WsMessage } from '../services/ws';
import type { Message } from '../components/MessageList';
import UserList from '../components/UserList';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import PrivatePanel from '../components/PrivatePanel';
import styles from './Chat.module.css';

interface OnlineUser {
  id: string;
  username: string;
  nickname: string | null;
  avatar_url: string | null;
}

interface Props {
  userId: string;
  username: string;
  nickname: string | null;
  avatarUrl: string | null;
  onLogout: () => void;
}

function toMessage(m: ServerMessage): Message {
  return {
    id: m.id,
    from_id: m.senderId,
    from_username: m.senderName,
    content: m.content,
    images: m.images ?? undefined,
    timestamp: m.createdAt,
  };
}

export default function Chat({ userId, username, nickname, avatarUrl, onLogout }: Props) {
  const navigate = useNavigate();

  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);

  const [hallMessages, setHallMessages] = useState<Message[]>([]);
  const [hallTyping, setHallTyping] = useState<string[]>([]);
  const [hallHasMore, setHallHasMore] = useState(false);

  const [privateMessages, setPrivateMessages] = useState<Message[]>([]);
  const [privateTyping, setPrivateTyping] = useState<string[]>([]);
  const [privateHasMore, setPrivateHasMore] = useState(false);

  const [activePeerId, setActivePeerId] = useState<string | null>(null);
  const [activePeerUsername, setActivePeerUsername] = useState('');

  const [activePanel, setActivePanel] = useState<'hall' | 'private'>('hall');

  const [privatePaneHeight, setPrivatePaneHeight] = useState(300);
  const [isDragging, setIsDragging] = useState(false);

  const [unread, setUnread] = useState<Map<string, number>>(new Map());

  const usernameMap = useRef<Map<string, string>>(new Map([[userId, username]]));
  const activePeerIdRef = useRef<string | null>(null);
  const hallTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const privateTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef({ startY: 0, startHeight: 0 });

  useEffect(() => {
    const unsub = wsClient.on((msg: WsMessage) => {
      if (msg.type === 'online_users' && msg.users) {
        const users = msg.users as OnlineUser[];
        users.forEach(u => usernameMap.current.set(u.id, u.nickname ?? u.username));
        setOnlineUsers(users);
      } else if (msg.type === 'user_joined') {
        usernameMap.current.set(msg.userId!, msg.nickname ?? msg.username!);
        setOnlineUsers(prev => {
          if (prev.some(u => u.id === msg.userId)) return prev;
          return [...prev, {
            id: msg.userId!,
            username: msg.username!,
            nickname: msg.nickname ?? null,
            avatar_url: msg.avatar_url ?? null,
          }];
        });
        setAllUsers(prev => {
          if (prev.some(u => u.id === msg.userId)) return prev;
          return [...prev, {
            id: msg.userId!,
            username: msg.username!,
            nickname: msg.nickname ?? null,
            avatar_url: msg.avatar_url ?? null,
          }];
        });
      } else if (msg.type === 'user_left') {
        setOnlineUsers(prev => prev.filter(u => u.id !== msg.userId));
      } else if (msg.type === 'hall_message') {
        const m = msg as any;
        setHallMessages(prev => [...prev, {
          id: m.id, from_id: m.from, from_username: m.fromName,
          content: m.content ?? '', images: m.images ?? undefined, timestamp: m.timestamp,
        }]);
      } else if (msg.type === 'private_message') {
        const m = msg as any;
        const peer = m.from === userId ? m.to : m.from;
        const isCurrentlyOpen = peer === activePeerIdRef.current;

        if (isCurrentlyOpen) {
          setPrivateMessages(prev => [...prev, {
            id: m.id, from_id: m.from,
            from_username: usernameMap.current.get(m.from) || m.from,
            content: m.content ?? '', images: m.images ?? undefined, timestamp: m.timestamp,
          }]);
        } else {
          setUnread(prev => {
            const next = new Map(prev);
            next.set(peer, (next.get(peer) ?? 0) + 1);
            return next;
          });
        }

        const peerName = usernameMap.current.get(peer) || peer;
        const content = m.content || '[图片]';
        maybeNotify(peerName, content, peer, isCurrentlyOpen);
      } else if (msg.type === 'typing') {
        const m = msg as any;
        const name = usernameMap.current.get(m.from) || m.from;
        if (m.to) {
          setPrivateTyping([name]);
          if (privateTypingTimer.current) clearTimeout(privateTypingTimer.current);
          privateTypingTimer.current = setTimeout(() => setPrivateTyping([]), 2000);
        } else {
          setHallTyping([name]);
          if (hallTypingTimer.current) clearTimeout(hallTypingTimer.current);
          hallTypingTimer.current = setTimeout(() => setHallTyping([]), 2000);
        }
      }
    });

    async function init() {
      wsClient.connect();
      const [{ messages, hasMore }, { users }] = await Promise.all([
        api.getMessages('hall'),
        api.getAllUsers(),
      ]);
      setHallHasMore(hasMore);
      setHallMessages(messages.map(toMessage));
      setAllUsers(users);
    }

    init().catch(console.error);

    return () => {
      unsub();
      wsClient.disconnect();
      setOnlineUsers([]);
      setHallMessages([]);
    };
  }, [userId]);

  async function maybeNotify(
    peerName: string,
    content: string,
    peer: string,
    isCurrentlyOpen: boolean,
  ) {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (Notification.permission !== 'granted') return;
    const shouldNotify = !document.hasFocus() || !isCurrentlyOpen;
    if (!shouldNotify) return;
    new Notification(peerName, {
      body: content.slice(0, 80),
      icon: '/favicon.ico',
    });
  }

  function onDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startHeight: privatePaneHeight };
    setIsDragging(true);

    function onMouseMove(ev: MouseEvent) {
      const delta = dragRef.current.startY - ev.clientY;
      setPrivatePaneHeight(
        Math.max(80, Math.min(dragRef.current.startHeight + delta, window.innerHeight - 200))
      );
    }

    function onMouseUp() {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  async function loadMoreHall() {
    if (!hallHasMore || hallMessages.length === 0) return;
    const before = hallMessages[0].timestamp;
    const { messages, hasMore } = await api.getMessages('hall', before);
    setHallHasMore(hasMore);
    setHallMessages(prev => [...messages.map(toMessage), ...prev]);
  }

  async function loadMorePrivate() {
    if (!privateHasMore || privateMessages.length === 0 || !activePeerIdRef.current) return;
    const chatId = [userId, activePeerIdRef.current].sort().join(':');
    const before = privateMessages[0].timestamp;
    const { messages, hasMore } = await api.getMessages(chatId, before);
    setPrivateHasMore(hasMore);
    setPrivateMessages(prev => [...messages.map(toMessage), ...prev]);
  }

  function sendHallMessage(text: string, imageUrl?: string) {
    api.sendMessage('hall', text, imageUrl ? [{ url: imageUrl }] : undefined).catch(console.error);
  }

  function sendPrivateMessage(text: string, imageUrl?: string) {
    if (!activePeerId) return;
    const chatId = [userId, activePeerId].sort().join(':');
    api.sendMessage(chatId, text, imageUrl ? [{ url: imageUrl }] : undefined, activePeerId).catch(console.error);
  }

  function handleSend(text: string, imageUrl?: string) {
    if (activePanel === 'hall') sendHallMessage(text, imageUrl);
    else sendPrivateMessage(text, imageUrl);
  }

  function sendTyping() { wsClient.send({ type: 'typing' }); }
  function sendPrivateTyping() {
    if (activePeerId) wsClient.send({ type: 'typing', to: activePeerId });
  }

  function handleTyping() {
    if (activePanel === 'hall') sendTyping();
    else sendPrivateTyping();
  }

  async function selectUser(peerId: string) {
    if (peerId === userId) return;
    const peerName = usernameMap.current.get(peerId) || peerId;
    activePeerIdRef.current = peerId;
    setActivePeerId(peerId);
    setActivePeerUsername(peerName);
    setActivePanel('private');
    setUnread(prev => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
    const chatId = [userId, peerId].sort().join(':');
    const { messages, hasMore } = await api.getMessages(chatId);
    setPrivateHasMore(hasMore);
    setPrivateMessages(messages.map(toMessage));
  }

  function closePrivate() {
    activePeerIdRef.current = null;
    setActivePeerId(null);
    setActivePanel('hall');
  }

  async function handleLogout() {
    await api.logout();
    clearTokens();
    onLogout();
    navigate('/login');
  }

  const onlineUserIds = new Set(onlineUsers.map(u => u.id));
  const inputPlaceholder = activePeerId
    ? (activePanel === 'hall' ? '发言于大厅...' : `私聊 ${activePeerUsername}...`)
    : '发言于大厅...';

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logo}>江湖</span>
          <span className={styles.roomName}># 公共大厅</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.username}>{nickname ?? username}</span>
          <button className={styles.inviteBtn} onClick={() => navigate('/settings')}>设置</button>
          <button className={styles.logoutBtn} onClick={handleLogout}>退出</button>
        </div>
      </header>

      <aside className={styles.sidebar}>
        <UserList
          allUsers={allUsers}
          onlineUserIds={onlineUserIds}
          currentUserId={userId}
          currentUserNickname={nickname}
          currentUserAvatarUrl={avatarUrl}
          activePrivateId={activePeerId}
          unread={unread}
          onSelectUser={selectUser}
        />
      </aside>

      <main className={styles.main}>
        <div className={styles.mainInner}>
          <div
            className={`${styles.hallPane} ${activePanel === 'hall' ? styles.paneActive : ''}`}
            onClick={() => setActivePanel('hall')}
          >
            <MessageList
              messages={hallMessages}
              currentUserId={userId}
              typingUsernames={hallTyping}
              hasMore={hallHasMore}
              onLoadMore={loadMoreHall}
            />
          </div>

          {activePeerId && (
            <>
              <div
                className={`${styles.divider} ${isDragging ? styles.dragging : ''}`}
                onMouseDown={onDividerMouseDown}
              />
              <div
                className={`${styles.privatePane} ${activePanel === 'private' ? styles.paneActive : ''}`}
                style={{ height: privatePaneHeight }}
                onClick={() => setActivePanel('private')}
              >
                <div className={styles.paneHeader}>
                  <span>私聊 · {activePeerUsername}</span>
                  <button
                    className={styles.paneCloseBtn}
                    onClick={e => { e.stopPropagation(); closePrivate(); }}
                  >×</button>
                </div>
                <PrivatePanel
                  messages={privateMessages}
                  currentUserId={userId}
                  typingUsernames={privateTyping}
                  hasMore={privateHasMore}
                  onLoadMore={loadMorePrivate}
                />
              </div>
            </>
          )}
        </div>

        <div className={styles.inputArea}>
          {activePeerId && (
            <div className={styles.panelTabs}>
              <button
                className={`${styles.tab} ${activePanel === 'hall' ? styles.tabActive : ''}`}
                onClick={() => setActivePanel('hall')}
              >大厅</button>
              <button
                className={`${styles.tab} ${activePanel === 'private' ? styles.tabActive : ''}`}
                onClick={() => setActivePanel('private')}
              >私聊 · {activePeerUsername}</button>
            </div>
          )}
          <MessageInput
            onSend={handleSend}
            onTyping={handleTyping}
            placeholder={inputPlaceholder}
          />
        </div>
      </main>
    </div>
  );
}
