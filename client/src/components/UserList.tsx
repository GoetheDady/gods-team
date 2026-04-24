import Avatar from './Avatar';
import styles from './UserList.module.css';
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
    <div className={styles.container}>
      <div className={styles.title}>用户 · {onlineUserIds.size} 在线</div>
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
              styles.user,
              !isOnline ? styles.offline : '',
              activePrivateId === user.id ? styles.active : '',
            ].join(' ')}
            onClick={() => !isSelf && onSelectUser(user.id)}
          >
            <div className={styles.avatarWrap}>
              <Avatar src={avatarSrc} name={displayName} size={28} />
              {count > 0 && (
                <span className={styles.badge}>{count > 99 ? '99+' : count}</span>
              )}
            </div>
            <span className={`${styles.name} ${isSelf ? styles.self : ''}`}>
              {displayName}{isSelf ? ' (我)' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}
