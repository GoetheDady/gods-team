import Avatar from './Avatar';
import styles from './UserList.module.css';

interface OnlineUser {
  id: string;
  username: string;
  nickname: string | null;
  avatar_url: string | null;
}

interface Props {
  users: OnlineUser[];
  currentUserId: string;
  currentUserNickname: string | null;
  currentUserAvatarUrl: string | null;
  activePrivateId: string | null;
  onSelectUser: (userId: string) => void;
}

export default function UserList({
  users,
  currentUserId,
  currentUserNickname,
  currentUserAvatarUrl,
  activePrivateId,
  onSelectUser,
}: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.title}>在线 · {users.length}</div>
      {users.map(user => {
        const isSelf = user.id === currentUserId;
        const displayName = isSelf
          ? (currentUserNickname ?? user.username)
          : (user.nickname ?? user.username);
        const avatarUrl = isSelf ? currentUserAvatarUrl : user.avatar_url;
        return (
          <div
            key={user.id}
            className={`${styles.user} ${activePrivateId === user.id ? styles.active : ''}`}
            onClick={() => !isSelf && onSelectUser(user.id)}
          >
            <Avatar src={avatarUrl} name={displayName} size={28} />
            <span className={`${styles.name} ${isSelf ? styles.self : ''}`}>
              {displayName}{isSelf ? ' (我)' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}
