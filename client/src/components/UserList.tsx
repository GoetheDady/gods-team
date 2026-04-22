import styles from './UserList.module.css';

interface OnlineUser {
  id: string;
  username: string;
}

interface Props {
  users: OnlineUser[];
  currentUserId: string;
  activePrivateId: string | null;
  onSelectUser: (userId: string) => void;
}

export default function UserList({ users, currentUserId, activePrivateId, onSelectUser }: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.title}>在线 · {users.length}</div>
      {users.map(user => (
        <div
          key={user.id}
          className={`${styles.user} ${activePrivateId === user.id ? styles.active : ''}`}
          onClick={() => user.id !== currentUserId && onSelectUser(user.id)}
        >
          <span className={styles.dot} />
          <span className={`${styles.name} ${user.id === currentUserId ? styles.self : ''}`}>
            {user.username}{user.id === currentUserId ? ' (我)' : ''}
          </span>
        </div>
      ))}
    </div>
  );
}
