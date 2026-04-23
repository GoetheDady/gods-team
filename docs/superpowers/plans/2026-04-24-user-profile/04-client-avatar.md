### Task 4：新增可复用 Avatar 组件

**Files:**
- Create: `client/src/components/Avatar.tsx`
- Create: `client/src/components/Avatar.module.css`

---

#### Step 1：创建 `client/src/components/Avatar.tsx`

```typescript
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
```

- [ ] 完成上述创建。

---

#### Step 2：创建 `client/src/components/Avatar.module.css`

```css
.img {
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.fallback {
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-weight: 600;
  color: rgba(0, 0, 0, 0.6);
  flex-shrink: 0;
  user-select: none;
}
```

- [ ] 完成上述创建。

---

#### Step 3：类型检查

```bash
cd client && npx tsc --noEmit
```

Expected: 无错误

- [ ] 完成。

---

#### Step 4：提交

```bash
git add client/src/components/Avatar.tsx client/src/components/Avatar.module.css
git commit -m "feat(client): add reusable Avatar component with deterministic color fallback"
```

- [ ] 完成。
