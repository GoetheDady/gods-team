import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearTokens } from '../services/api';
import type { ServerMessage } from '../services/api';
import { wsClient } from '../services/ws';
import type { WsMessage } from '../services/ws';
import type { Message } from '../components/MessageList';
import UserList from '../components/UserList';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import PrivatePanel from '../components/PrivatePanel';
import styles from './Chat.module.css';

interface OnlineUser { id: string; username: string; }

interface Props {
  userId: string;
  username: string;
  onLogout: () => void;
}

// 服务端消息格式 → 组件消息格式的转换
// 服务端返回 senderId/senderName，组件内部使用 from_id/from_username
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

export default function Chat({ userId, username, onLogout }: Props) {
  const navigate = useNavigate();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [hallMessages, setHallMessages] = useState<Message[]>([]);
  const [hallTyping, setHallTyping] = useState<string[]>([]);
  const [hallHasMore, setHallHasMore] = useState(false);
  const [privateMessages, setPrivateMessages] = useState<Message[]>([]);
  const [privateTyping, setPrivateTyping] = useState<string[]>([]);
  const [privateHasMore, setPrivateHasMore] = useState(false);
  const [activePeerId, setActivePeerId] = useState<string | null>(null);
  const [activePeerUsername, setActivePeerUsername] = useState('');

  // userId → username 映射，用于私聊消息中显示发送者名称
  const usernameMap = useRef<Map<string, string>>(new Map([[userId, username]]));
  // 使用 ref 同步 activePeerId，避免 WS handler 闭包读取 stale state
  // React StrictMode 下 useEffect 会执行两次，如果用 state 读取 activePeerId，
  // 第二次执行时 handler 闭包中的值可能是旧的
  const activePeerIdRef = useRef<string | null>(null);
  const hallTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const privateTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 初始化：注册 WS 消息处理器 → 连接 WS → 加载大厅历史
  useEffect(() => {
    // wsClient.on() 必须在 useEffect 同步顶部注册，
    // 不能放在 async init() 内部，否则 cleanup 时 handler 还没注册导致无法取消订阅
    const unsub = wsClient.on((msg: WsMessage) => {
      if (msg.type === 'online_users' && msg.users) {
        const users = msg.users as OnlineUser[];
        users.forEach(u => usernameMap.current.set(u.id, u.username));
        setOnlineUsers(users);
      } else if (msg.type === 'user_joined') {
        usernameMap.current.set(msg.userId!, msg.username!);
        setOnlineUsers(prev => {
          if (prev.some(u => u.id === msg.userId)) return prev;
          return [...prev, { id: msg.userId!, username: msg.username! }];
        });
      } else if (msg.type === 'user_left') {
        setOnlineUsers(prev => prev.filter(u => u.id !== msg.userId));
      } else if (msg.type === 'hall_message') {
        // 大厅消息：直接追加到列表（服务端通过 WS 推送，发送者也会收到一份）
        const m = msg as any;
        setHallMessages(prev => [...prev, {
          id: m.id, from_id: m.from, from_username: m.fromName,
          content: m.content ?? '', images: m.images ?? undefined, timestamp: m.timestamp,
        }]);
      } else if (msg.type === 'private_message') {
        // 私聊消息：只在当前打开的私聊面板中显示
        const m = msg as any;
        const peer = m.from === userId ? m.to : m.from;
        if (peer === activePeerIdRef.current) {
          setPrivateMessages(prev => [...prev, {
            id: m.id, from_id: m.from,
            from_username: usernameMap.current.get(m.from) || m.from,
            content: m.content ?? '', images: m.images ?? undefined, timestamp: m.timestamp,
          }]);
        }
      } else if (msg.type === 'typing') {
        const m = msg as any;
        const name = usernameMap.current.get(m.from) || m.from;
        if (m.to) {
          // 私聊 typing
          setPrivateTyping([name]);
          if (privateTypingTimer.current) clearTimeout(privateTypingTimer.current);
          privateTypingTimer.current = setTimeout(() => setPrivateTyping([]), 2000);
        } else {
          // 大厅 typing
          setHallTyping([name]);
          if (hallTypingTimer.current) clearTimeout(hallTypingTimer.current);
          hallTypingTimer.current = setTimeout(() => setHallTyping([]), 2000);
        }
      }
    });

    async function init() {
      // 直接连接 WS，连接建立后自动发送 auth 消息
      wsClient.connect();
      // 加载大厅最近 50 条消息
      const { messages, hasMore } = await api.getMessages('hall');
      setHallHasMore(hasMore);
      setHallMessages(messages.map(toMessage));
    }

    init().catch(console.error);

    return () => {
      unsub();
      wsClient.disconnect();
      setOnlineUsers([]);
      setHallMessages([]);
    };
  }, [userId]);

  // 大厅加载更多（滚到顶触发）
  // 取当前最早一条消息的 timestamp 作为 before 参数
  async function loadMoreHall() {
    if (!hallHasMore || hallMessages.length === 0) return;
    const before = hallMessages[0].timestamp;
    const { messages, hasMore } = await api.getMessages('hall', before);
    setHallHasMore(hasMore);
    setHallMessages(prev => [...messages.map(toMessage), ...prev]);
  }

  // 私聊加载更多（滚到顶触发）
  async function loadMorePrivate() {
    if (!privateHasMore || privateMessages.length === 0 || !activePeerIdRef.current) return;
    const chatId = [userId, activePeerIdRef.current].sort().join(':');
    const before = privateMessages[0].timestamp;
    const { messages, hasMore } = await api.getMessages(chatId, before);
    setPrivateHasMore(hasMore);
    setPrivateMessages(prev => [...messages.map(toMessage), ...prev]);
  }

  // 通过 HTTP POST 发送大厅消息
  // 服务端写库后会通过 WS 广播回来，所以不需要手动添加到 hallMessages
  function sendHallMessage(text: string, imageUrl?: string) {
    api.sendMessage('hall', text, imageUrl ? [{ url: imageUrl }] : undefined).catch(console.error);
  }

  // 通过 HTTP POST 发送私聊消息
  // chatId 由两个 userId 排序后拼接，保证同一对用户的私聊 ID 一致
  function sendPrivateMessage(text: string, imageUrl?: string) {
    if (!activePeerId) return;
    const chatId = [userId, activePeerId].sort().join(':');
    api.sendMessage(chatId, text, imageUrl ? [{ url: imageUrl }] : undefined, activePeerId).catch(console.error);
  }

  // typing 状态通过 WS 发送（频率高、不需要持久化）
  function sendTyping() { wsClient.send({ type: 'typing' }); }
  function sendPrivateTyping() {
    if (activePeerId) wsClient.send({ type: 'typing', to: activePeerId });
  }

  // 点击用户列表中的用户，打开私聊面板并加载该对话历史
  async function selectUser(peerId: string) {
    if (peerId === userId) return;
    const peerName = usernameMap.current.get(peerId) || peerId;
    activePeerIdRef.current = peerId;
    setActivePeerId(peerId);
    setActivePeerUsername(peerName);
    const chatId = [userId, peerId].sort().join(':');
    const { messages, hasMore } = await api.getMessages(chatId);
    setPrivateHasMore(hasMore);
    setPrivateMessages(messages.map(toMessage));
  }

  async function handleLogout() {
    await api.logout();
    clearTokens();
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
          <span className={styles.username}>{username}</span>
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
          hasMore={hallHasMore}
          onLoadMore={loadMoreHall}
        />
        <MessageInput
          onSend={sendHallMessage}
          onTyping={sendTyping}
          placeholder="发言于大厅..."
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
          onClose={() => { activePeerIdRef.current = null; setActivePeerId(null); }}
          hasMore={privateHasMore}
          onLoadMore={loadMorePrivate}
        />
      </aside>
    </div>
  );
}
