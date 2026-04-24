interface Props {
  src?: string | null;
  name: string;
  size?: number;
}

// 根据 name 字符串生成确定性颜色（6 种低饱和江湖配色）
function getColor(name: string): string {
  const colors = [
    'linear-gradient(145deg, #c9a84c, #6f5618)',
    'linear-gradient(145deg, #8f7a52, #463a25)',
    'linear-gradient(145deg, #7f6742, #352d22)',
    'linear-gradient(145deg, #6f7566, #30362f)',
    'linear-gradient(145deg, #80605a, #3b2d2b)',
    'linear-gradient(145deg, #6f6a7f, #302f3d)',
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
        className="block shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 select-none items-center justify-center rounded-full border border-jianghu-border-gold font-display font-semibold text-jianghu-text"
      style={{ width: size, height: size, background: getColor(name), fontSize: size * 0.4 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
