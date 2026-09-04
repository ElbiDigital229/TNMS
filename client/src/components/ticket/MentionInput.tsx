import { useState, useRef, useEffect, useCallback } from "react";

interface MentionUser {
  id: string;
  fullName: string;
  username: string;
  role?: { name: string };
  department?: { name: string } | null;
}

interface MentionInputProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  users: MentionUser[];
}

export default function MentionInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Add a comment...",
  users,
}: MentionInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredUsers = mentionQuery
    ? users.filter((u) => {
        const q = mentionQuery.toLowerCase();
        return (
          u.fullName.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          (u.department?.name.toLowerCase().includes(q) ?? false)
        );
      })
    : users;

  const displayedUsers = filteredUsers.slice(0, 10);

  // Detect @ trigger
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart ?? newValue.length;
    onChange(newValue);

    // Find the last @ before the cursor
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex >= 0) {
      // Check that @ is at start or preceded by a space
      const charBefore = lastAtIndex > 0 ? newValue[lastAtIndex - 1] : " ";
      if (charBefore === " " || lastAtIndex === 0) {
        const query = textBeforeCursor.slice(lastAtIndex + 1);
        // Only show dropdown if no space-space pattern (allow one space for two-word names)
        const spaceCount = (query.match(/ /g) || []).length;
        if (spaceCount <= 1 && !query.includes("\n")) {
          setMentionQuery(query);
          setMentionStartIndex(lastAtIndex);
          setShowDropdown(true);
          setSelectedIndex(0);
          return;
        }
      }
    }

    setShowDropdown(false);
    setMentionQuery("");
    setMentionStartIndex(-1);
  };

  const insertMention = useCallback(
    (user: MentionUser) => {
      const before = value.slice(0, mentionStartIndex);
      const afterCursor = value.slice(
        mentionStartIndex + 1 + mentionQuery.length
      );
      const mention = `@${user.fullName}`;
      const newValue = before + mention + " " + afterCursor;
      onChange(newValue);
      setShowDropdown(false);
      setMentionQuery("");
      setMentionStartIndex(-1);

      // Refocus input
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const pos = before.length + mention.length + 1;
          inputRef.current.setSelectionRange(pos, pos);
        }
      }, 0);
    },
    [value, mentionStartIndex, mentionQuery, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showDropdown && displayedUsers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < displayedUsers.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : displayedUsers.length - 1
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(displayedUsers[selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowDropdown(false);
        return;
      }
    }

    // Normal Enter submits the comment
    if (e.key === "Enter" && !e.shiftKey && !showDropdown) {
      e.preventDefault();
      onSubmit();
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    if (!showDropdown || !dropdownRef.current) return;
    const items = dropdownRef.current.querySelectorAll("[data-mention-item]");
    items[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, showDropdown]);

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-[13px] shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
      />
      {showDropdown && displayedUsers.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 bottom-full mb-1 max-h-40 overflow-y-auto rounded-lg bg-white shadow-lg ring-1 ring-gray-200 z-50"
        >
          {displayedUsers.map((user, idx) => (
            <div
              key={user.id}
              data-mention-item
              className={`px-3 py-2 cursor-pointer text-[13px] ${
                idx === selectedIndex ? "bg-gray-50" : ""
              } hover:bg-gray-50`}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(user);
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <span className="font-medium text-gray-900">
                {user.fullName}
              </span>
              {user.role && (
                <span className="ml-2 text-[11px] text-gray-400">
                  {user.role.name}
                </span>
              )}
              <span className="ml-2 text-[11px] text-gray-400">
                @{user.username}
              </span>
              {/* The list spans the whole org now, so the department is what
                  tells two people with the same first name apart. */}
              {user.department && (
                <span className="ml-2 text-[11px] text-gray-400">
                  · {user.department.name}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
