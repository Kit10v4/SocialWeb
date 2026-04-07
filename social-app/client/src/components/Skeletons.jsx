/**
 * Skeleton loaders for various UI components.
 * Use these to show animated placeholders while data is loading.
 */

/**
 * Skeleton for conversation list items
 */
export function ConversationListSkeleton({ count = 5 }) {
  return (
    <div className="p-3 space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          {/* Avatar skeleton */}
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
            {/* Online indicator skeleton */}
            <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-600 ring-2 ring-white dark:ring-gray-800" />
          </div>

          {/* Content skeleton */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Name */}
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
            {/* Last message preview */}
            <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-40" />
          </div>

          {/* Time / badge skeleton */}
          <div className="flex flex-col items-end gap-1">
            <div className="h-3 w-12 bg-gray-100 dark:bg-gray-600 rounded" />
            <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for the profile page
 */
export function ProfilePageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pb-16 md:pb-0 animate-pulse">
      {/* Cover photo skeleton */}
      <div className="relative h-40 md:h-56 bg-gradient-to-r from-gray-300 to-gray-200 dark:from-gray-700 dark:to-gray-600" />

      <div className="max-w-4xl mx-auto px-4">
        {/* Avatar and info section */}
        <div className="relative -mt-16 md:-mt-20 mb-4">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            {/* Avatar skeleton */}
            <div className="w-28 h-28 md:w-36 md:h-36 rounded-full bg-gray-300 dark:bg-gray-600 ring-4 ring-white dark:ring-gray-900" />

            {/* Info skeleton */}
            <div className="flex-1 py-2 space-y-2">
              <div className="h-7 bg-gray-300 dark:bg-gray-600 rounded w-48" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
            </div>

            {/* Action buttons skeleton */}
            <div className="flex gap-2">
              <div className="h-10 w-28 bg-gray-300 dark:bg-gray-600 rounded-full" />
              <div className="h-10 w-28 bg-gray-200 dark:bg-gray-700 rounded-full" />
            </div>
          </div>
        </div>

        {/* Bio skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="flex justify-around mb-4">
          <div className="text-center space-y-1">
            <div className="h-6 w-8 bg-gray-200 dark:bg-gray-700 rounded mx-auto" />
            <div className="h-3 w-12 bg-gray-100 dark:bg-gray-600 rounded mx-auto" />
          </div>
          <div className="text-center space-y-1">
            <div className="h-6 w-8 bg-gray-200 dark:bg-gray-700 rounded mx-auto" />
            <div className="h-3 w-12 bg-gray-100 dark:bg-gray-600 rounded mx-auto" />
          </div>
          <div className="text-center space-y-1">
            <div className="h-6 w-8 bg-gray-200 dark:bg-gray-700 rounded mx-auto" />
            <div className="h-3 w-12 bg-gray-100 dark:bg-gray-600 rounded mx-auto" />
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="flex gap-2 mb-4">
          <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="h-10 w-20 bg-gray-100 dark:bg-gray-600 rounded-full" />
          <div className="h-10 w-20 bg-gray-100 dark:bg-gray-600 rounded-full" />
        </div>

        {/* Post skeleton cards */}
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-3 w-16 bg-gray-100 dark:bg-gray-600 rounded" />
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="h-4 bg-gray-100 dark:bg-gray-600 rounded w-full" />
                <div className="h-4 bg-gray-100 dark:bg-gray-600 rounded w-5/6" />
              </div>
              <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for chat messages
 */
export function ChatMessagesSkeleton({ count = 6 }) {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => {
        const isOwn = i % 3 === 0;
        return (
          <div key={i} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
            {!isOwn && <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 mr-2" />}
            <div
              className={`${isOwn ? "bg-blue-100 dark:bg-blue-900/30" : "bg-gray-200 dark:bg-gray-700"} rounded-2xl px-4 py-2`}
              style={{ width: `${Math.floor(Math.random() * 40) + 30}%` }}
            >
              <div className="h-4 bg-gray-300/50 dark:bg-gray-600/50 rounded" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
