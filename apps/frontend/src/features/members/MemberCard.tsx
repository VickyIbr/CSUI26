import type { ComponentProps } from 'react';

import { Pencil } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Member } from '@/features/members/types';

function memberInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

interface MemberAvatarProps extends ComponentProps<typeof Avatar> {
  member: Member;
  alt?: string;
}

export function MemberAvatar({ member, alt = '', ...props }: MemberAvatarProps) {
  const cfg = member.foto.config;
  const imgStyle = cfg
    ? {
        objectPosition: `${cfg.x}% ${cfg.y}%`,
        transform: `scale(${cfg.zoom}) rotate(${cfg.rotate ?? 0}deg)`,
      }
    : undefined;

  return (
    <Avatar {...props}>
      {member.foto.url ? (
        <AvatarImage src={member.foto.url} alt={alt} style={imgStyle} />
      ) : null}
      <AvatarFallback>{memberInitials(member.name)}</AvatarFallback>
    </Avatar>
  );
}

interface MemberCardProps {
  member: Member;
  isAdmin?: boolean;
  onEdit: (member: Member) => void;
}

export function MemberCard({ member, isAdmin = false, onEdit }: MemberCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <MemberAvatar member={member} size="lg" />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {member.name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {member.nama_panggilan} · {member.major}
          </span>
        </div>

        {isAdmin ? (
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onEdit(member)}
              aria-label={`Edit ${member.name}`}
            >
              <Pencil aria-hidden="true" />
            </Button>

          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}





