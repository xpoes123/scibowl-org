import { useMemo } from 'react';
import { getCachedAvatar } from '../utils/avatarGenerator';

interface AvatarProps {
  username: string;
  size?: number;
  className?: string;
}

export const Avatar = ({ username, size = 64, className = '' }: AvatarProps) => {
  const avatarDataURL = useMemo(() => {
    return getCachedAvatar(username, size);
  }, [username, size]);

  return (
    <img
      src={avatarDataURL}
      alt={`${username}'s avatar`}
      className={`rounded-full ${className}`}
      style={{ width: size, height: size }}
    />
  );
};
