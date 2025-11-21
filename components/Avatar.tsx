import React from 'react';

interface AvatarProps {
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({
  firstName,
  lastName,
  avatarUrl,
  size = 'medium',
  className = '',
}) => {
  // Generate initials from first and last name
  const getInitials = () => {
    const firstInitial = firstName?.charAt(0)?.toUpperCase() || '';
    const lastInitial = lastName?.charAt(0)?.toUpperCase() || '';
    return firstInitial + lastInitial || '?';
  };

  // Generate consistent color based on name
  const getAvatarColor = () => {
    const name = `${firstName || ''}${lastName || ''}`;
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-red-500',
      'bg-yellow-500',
      'bg-teal-500',
    ];

    // Simple hash function to get consistent color
    const hash = name.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);

    return colors[Math.abs(hash) % colors.length];
  };

  // Size classes
  const sizeClasses = {
    small: 'w-8 h-8 text-xs',
    medium: 'w-10 h-10 text-sm',
    large: 'w-16 h-16 text-xl',
  };

  const sizeClass = sizeClasses[size];

  // If avatar URL exists, show image
  if (avatarUrl) {
    return (
      <div className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0 ${className}`}>
        <img
          src={avatarUrl}
          alt={`${firstName || ''} ${lastName || ''}`.trim() || 'User avatar'}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Otherwise, show dynamic initials avatar
  return (
    <div
      className={`${sizeClass} ${getAvatarColor()} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${className}`}
    >
      {getInitials()}
    </div>
  );
};

export default Avatar;
