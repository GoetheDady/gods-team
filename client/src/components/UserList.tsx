import Avatar from './Avatar';
import type { AllUser } from '../services/api';

interface Props {
  allUsers: AllUser[];
  onlineUserIds: Set<string>;
  currentUserId: string;
  currentUserNickname: string | null;
  currentUserAvatarUrl: string | null;
  activePrivateId: string | null;
  unread: Map<string, number>;
  onSelectUser: (userId: string) => void;
}

export default function UserList({
  allUsers,
  onlineUserIds,
  currentUserId,
  currentUserNickname,
  currentUserAvatarUrl,
  activePrivateId,
  unread,
  onSelectUser,
}: Props) {
  const sorted = [
    ...allUsers.filter(u => onlineUserIds.has(u.id)),
    ...allUsers.filter(u => !onlineUserIds.has(u.id)),
  ];

  return (
    <div className="py-4">
      <div className="px-4 pb-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-jianghu-muted">用户 · {onlineUserIds.size} 在线</div>
      {sorted.map(user => {
        const isSelf = user.id === currentUserId;
        const isOnline = onlineUserIds.has(user.id);
        const displayName = isSelf
          ? (currentUserNickname ?? user.username)
          : (user.nickname ?? user.username);
        const avatarSrc = isSelf ? currentUserAvatarUrl : user.avatar_url;
        const count = unread.get(user.id) ?? 0;

        return (
          <div
            key={user.id}
            className={[
              'flex items-center gap-2.5 px-4 py-[7px] transition-colors duration-150 ease-in',
              isSelf ? 'cursor-default hover:bg-transparent' : 'cursor-pointer hover:bg-jianghu-border-subtle',
              !isOnline ? 'opacity-40' : '',
              activePrivateId === user.id ? 'bg-jianghu-gold-glow' : '',
            ].join(' ')}
            onClick={() => !isSelf && onSelectUser(user.id)}
          >
            <div className="relative shrink-0">
              <Avatar src={avatarSrc} name={displayName} size={28} />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-jianghu-danger px-[3px] font-mono text-[9px] leading-none text-white">{count > 99 ? '99+' : count}</span>
              )}
            </div>
            <span className={`overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs ${isSelf ? 'text-jianghu-gold' : 'text-jianghu-text'}`}>
              {displayName}{isSelf ? ' (我)' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}
