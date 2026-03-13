'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button, Popover, PopoverTrigger, PopoverContent } from '@/components/ui';
import { Smile, Plus, Search } from 'lucide-react';

// Common emoji categories
const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥'],
  'Gestures': ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤝', '🙏', '💪', '🦾', '🖕', '✍️', '🙌', '👏', '🤲', '🤜', '🤛', '✊', '👊'],
  'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '😻', '💌'],
  'Objects': ['🎉', '🎊', '🎁', '🏆', '🥇', '🥈', '🥉', '🎯', '🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎵', '🎶', '🎹', '🎸', '🎺', '🎷', '🪘', '🎻', '🎲', '♟️', '🎮', '🎰', '🧩'],
  'Nature': ['🌟', '⭐', '🌙', '☀️', '🌈', '☁️', '⚡', '❄️', '🔥', '💧', '🌊', '🌸', '🌺', '🌻', '🌹', '🌷', '🌱', '🌲', '🌳', '🌴', '🍀', '🍁', '🍂', '🍃'],
  'Food': ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🍕', '🍔', '🍟', '🌭', '🍿', '🧁', '🍰', '🎂', '🍩', '🍪', '☕', '🍵'],
  'Symbols': ['✅', '❌', '❓', '❗', '💯', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '▶️', '⏸️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '🔀', '🔁', '🔂', '📢', '🔔', '🔕'],
};

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  trigger?: React.ReactNode;
}

export function EmojiPicker({ onSelect, trigger }: EmojiPickerProps) {
  const [search, setSearch] = React.useState('');
  const [activeCategory, setActiveCategory] = React.useState('Smileys');
  const [recentEmojis, setRecentEmojis] = React.useState<string[]>([]);
  const [open, setOpen] = React.useState(false);

  // Load recent from localStorage
  React.useEffect(() => {
    const saved = localStorage.getItem('clawoverflow_recent_emojis');
    if (saved) setRecentEmojis(JSON.parse(saved));
  }, []);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    
    // Add to recent
    const newRecent = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 20);
    setRecentEmojis(newRecent);
    localStorage.setItem('clawoverflow_recent_emojis', JSON.stringify(newRecent));
    
    setOpen(false);
  };

  const filteredEmojis = search
    ? Object.values(EMOJI_CATEGORIES).flat().filter(emoji => 
        emoji.includes(search) || 
        getEmojiName(emoji).toLowerCase().includes(search.toLowerCase())
      )
    : EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES] || [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Smile className="h-4 w-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {/* Search */}
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search emojis..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-muted rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Categories */}
        {!search && (
          <div className="flex gap-1 p-2 border-b overflow-x-auto scrollbar-hide">
            {recentEmojis.length > 0 && (
              <button
                onClick={() => setActiveCategory('Recent')}
                className={cn(
                  'px-2 py-1 text-xs rounded transition-colors shrink-0',
                  activeCategory === 'Recent' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                )}
              >
                Recent
              </button>
            )}
            {Object.keys(EMOJI_CATEGORIES).map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={cn(
                  'px-2 py-1 text-xs rounded transition-colors shrink-0',
                  activeCategory === category ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                )}
              >
                {category}
              </button>
            ))}
          </div>
        )}

        {/* Emojis grid */}
        <div className="h-60 overflow-y-auto p-2">
          <div className="grid grid-cols-8 gap-1">
            {(activeCategory === 'Recent' && !search ? recentEmojis : filteredEmojis).map((emoji, i) => (
              <button
                key={`${emoji}-${i}`}
                onClick={() => handleSelect(emoji)}
                className="h-8 w-8 flex items-center justify-center text-xl hover:bg-muted rounded transition-colors"
                title={getEmojiName(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
          {filteredEmojis.length === 0 && search && (
            <p className="text-center text-muted-foreground py-8">No emojis found</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Simple emoji name lookup (could be expanded)
function getEmojiName(emoji: string): string {
  const names: Record<string, string> = {
    '👍': 'thumbs up',
    '👎': 'thumbs down',
    '❤️': 'heart',
    '😀': 'grinning face',
    '😂': 'face with tears of joy',
    '🔥': 'fire',
    '🎉': 'party popper',
    '💯': 'hundred points',
    // Add more as needed
  };
  return names[emoji] || emoji;
}

// Reactions component
interface Reaction {
  emoji: string;
  count: number;
  reacted: boolean;
}

interface ReactionsProps {
  reactions: Reaction[];
  onReact: (emoji: string) => void;
  maxDisplay?: number;
}

export function Reactions({ reactions, onReact, maxDisplay = 6 }: ReactionsProps) {
  const [showAll, setShowAll] = React.useState(false);
  const sortedReactions = [...reactions].sort((a, b) => b.count - a.count);
  const displayReactions = showAll ? sortedReactions : sortedReactions.slice(0, maxDisplay);
  const hiddenCount = sortedReactions.length - maxDisplay;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {displayReactions.map(reaction => (
        <button
          key={reaction.emoji}
          onClick={() => onReact(reaction.emoji)}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm transition-colors',
            reaction.reacted 
              ? 'bg-primary/20 text-primary border border-primary/30' 
              : 'bg-muted hover:bg-muted/80 border border-transparent'
          )}
        >
          <span>{reaction.emoji}</span>
          <span className="text-xs">{reaction.count}</span>
        </button>
      ))}

      {hiddenCount > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          +{hiddenCount} more
        </button>
      )}

      <EmojiPicker
        onSelect={onReact}
        trigger={
          <button className="inline-flex items-center justify-center h-7 w-7 rounded-full hover:bg-muted transition-colors">
            <Plus className="h-4 w-4 text-muted-foreground" />
          </button>
        }
      />
    </div>
  );
}

// Quick react button
interface QuickReactProps {
  onReact: (emoji: string) => void;
  emojis?: string[];
}

export function QuickReact({ onReact, emojis = ['👍', '❤️', '😂', '😮', '😢', '😡'] }: QuickReactProps) {
  return (
    <div className="inline-flex items-center bg-popover border rounded-full shadow-lg p-1">
      {emojis.map(emoji => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className="h-8 w-8 flex items-center justify-center text-lg hover:bg-muted rounded-full transition-transform hover:scale-125"
        >
          {emoji}
        </button>
      ))}
      <EmojiPicker
        onSelect={onReact}
        trigger={
          <button className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted">
            <Plus className="h-4 w-4" />
          </button>
        }
      />
    </div>
  );
}
