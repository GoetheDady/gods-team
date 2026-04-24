import { useState, useEffect, useRef, useMemo } from 'react';
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
    avatar_url: m.senderAvatarUrl,
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

  interface WsHallMessage { id: string; from: string; fromName: string; avatar_url?: string; content?: string; images?: { url: string }[]; timestamp: number; }
  interface WsPrivateMessage { id: string; from: string; to: string; avatar_url?: string; content?: string; images?: { url: string }[]; timestamp: number; }
  interface WsTypingMessage { from: string; to?: string; }

  const usernameMap = useRef<Map<string, string>>(new Map([[userId, username]]));
  const activePeerIdRef = useRef<string | null>(null);
  const hallTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const privateTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef({ startY: 0, startHeight: 0 });

  async function maybeNotify(
    peerName: string,
    content: string,
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
        const m = msg as unknown as WsHallMessage;
        setHallMessages(prev => [...prev, {
          id: m.id, from_id: m.from, from_username: m.fromName,
          avatar_url: m.avatar_url ?? null,
          content: m.content ?? '', images: m.images ?? undefined, timestamp: m.timestamp,
        }]);
      } else if (msg.type === 'private_message') {
        const m = msg as unknown as WsPrivateMessage;
        const peer = m.from === userId ? m.to : m.from;
        const isCurrentlyOpen = peer === activePeerIdRef.current;

        if (isCurrentlyOpen) {
          setPrivateMessages(prev => [...prev, {
            id: m.id, from_id: m.from,
            from_username: usernameMap.current.get(m.from) || m.from,
            avatar_url: m.avatar_url ?? null,
            content: m.content ?? '', images: m.images ?? undefined, timestamp: m.timestamp,
          }]);
        } else if (m.from !== userId) {
          setUnread(prev => {
            const next = new Map(prev);
            next.set(peer, (next.get(peer) ?? 0) + 1);
            return next;
          });
        }

        if (m.from !== userId) {
          const peerName = usernameMap.current.get(peer) || peer;
          const content = m.content || '[图片]';
          maybeNotify(peerName, content, isCurrentlyOpen);
        }
      } else if (msg.type === 'typing') {
        const m = msg as unknown as WsTypingMessage;
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
    setPrivateMessages([]);
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

  const onlineUserIds = useMemo(() => new Set(onlineUsers.map(u => u.id)), [onlineUsers]);
  const inputPlaceholder = activePeerId
    ? (activePanel === 'hall' ? '发言于大厅...' : `私聊 ${activePeerUsername}...`)
    : '发言于大厅...';

  return (
    <div className="grid h-full grid-cols-[200px_1fr] grid-rows-[48px_1fr] [grid-template-areas:'header_header'_'sidebar_main']">
      <header className="[grid-area:header] flex items-center justify-between border-b border-jianghu-border-subtle bg-jianghu-elevated px-5">
        <div className="flex items-center gap-4">
          <span className="font-display text-lg text-jianghu-gold">江湖</span>
          <span className="font-mono text-xs text-jianghu-secondary"># 公共大厅</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-jianghu-secondary">{nickname ?? username}</span>
          <button className="rounded border border-jianghu-border-gold px-2.5 py-1 text-xs text-jianghu-secondary transition-colors duration-150 ease-in hover:border-jianghu-gold hover:text-jianghu-gold" onClick={() => navigate('/settings')}>设置</button>
          <button className="text-xs text-jianghu-muted transition-colors duration-150 ease-in hover:text-jianghu-danger" onClick={handleLogout}>退出</button>
        </div>
      </header>

      <aside className="[grid-area:sidebar] overflow-y-auto border-r border-jianghu-border-subtle bg-jianghu-sidebar">
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

      <main className="[grid-area:main] flex flex-col overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          <div
            className={`flex min-h-20 flex-1 flex-col overflow-hidden border-r border-jianghu-border-subtle outline outline-1 -outline-offset-1 transition-[outline-color] duration-150 ease-in ${activePanel === 'hall' ? 'outline-jianghu-gold' : 'outline-transparent'}`}
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
                className={`h-[5px] shrink-0 cursor-row-resize bg-transparent transition-colors duration-150 ease-in hover:bg-jianghu-gold ${isDragging ? 'bg-jianghu-gold' : ''}`}
                onMouseDown={onDividerMouseDown}
              />
              <div
                className={`flex min-h-20 shrink-0 flex-col overflow-hidden border-t border-jianghu-border-subtle outline outline-1 -outline-offset-1 transition-[outline-color] duration-150 ease-in ${activePanel === 'private' ? 'outline-jianghu-gold' : 'outline-transparent'}`}
                style={{ height: privatePaneHeight }}
                onClick={() => setActivePanel('private')}
              >
                <div className="flex shrink-0 items-center justify-between border-b border-jianghu-border-subtle px-4 py-1.5 font-mono text-xs text-jianghu-secondary">
                  <span>私聊 · {activePeerUsername}</span>
                  <button
                    className="text-base leading-none text-jianghu-muted transition-colors duration-150 ease-in hover:text-jianghu-text"
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

        <div className="shrink-0">
          {activePeerId && (
            <div className="flex gap-1 px-4 pt-1.5">
              <button
                className={`rounded border px-2.5 py-[3px] font-mono text-[11px] transition-colors duration-150 ease-in ${activePanel === 'hall' ? 'border-jianghu-border-gold text-jianghu-gold' : 'border-transparent text-jianghu-muted'}`}
                onClick={() => setActivePanel('hall')}
              >大厅</button>
              <button
                className={`rounded border px-2.5 py-[3px] font-mono text-[11px] transition-colors duration-150 ease-in ${activePanel === 'private' ? 'border-jianghu-border-gold text-jianghu-gold' : 'border-transparent text-jianghu-muted'}`}
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
