import { Link } from "react-router-dom";
import { Users } from "lucide-react";

/**
 * Compact friend card used in the "Bạn bè" tab.
 * @prop {object} friend  — UserMini shape: { id, username, avatar }
 * @prop {number} [mutualCount] — mutual friends count (optional)
 */
export default function FriendCard({ friend, mutualCount }) {
  return (
    <Link
      to={`/profile/${friend.username}`}
      className="group flex flex-col items-center bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Avatar */}
      <div className="h-20 w-20 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-indigo-500 shadow-sm flex-shrink-0">
        {friend.avatar ? (
          <img
            src={friend.avatar}
            alt={friend.username}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white text-2xl font-bold">
            {friend.username[0].toUpperCase()}
          </div>
        )}
      </div>

      {/* Info */}
      <p className="mt-3 font-semibold text-gray-900 text-sm text-center truncate w-full group-hover:text-blue-600 transition-colors">
        {friend.username}
      </p>

      {mutualCount !== undefined && mutualCount > 0 && (
        <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
          <Users className="h-3 w-3" />
          {mutualCount} bạn chung
        </p>
      )}
    </Link>
  );
}
