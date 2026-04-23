import styles from './Avatar.module.css';

interface Props {
  src?: string | null;
  name: string;
  size?: number;
}

// 根据 name 字符串生成确定性颜色（6 种品牌配色）
function getColor(name: string): string {
  const colors = [
    'linear-gradient(145deg, #c9a84c, #8b6914)', // gold
    'linear-gradient(145deg, #5b8fd4, #2a5199)', // blue
    'linear-gradient(145deg, #4db87a, #1d7a47)', // green
    'linear-gradient(145deg, #b45b8f, #7a2a5a)', // purple
    'linear-gradient(145deg, #d47a5b, #994d2a)', // orange
    'linear-gradient(145deg, #5bd4c9, #2a7a76)', // teal
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function Avatar({ src, name, size = 32 }: Props) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={styles.img}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={styles.fallback}
      style={{ width: size, height: size, background: getColor(name), fontSize: size * 0.4 }}
    >
      {name.charAt(0)}
    </div>
  );
}
