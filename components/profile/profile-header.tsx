"use client";

import { useState } from "react";
import Image from "next/image";
import { User } from "lucide-react";
import { EditProfileModal } from "./edit-profile-modal";
import { useRouter } from "next/navigation";

interface ProfileHeaderProps {
  userId: string;
  name: string;
  avatarUrl: string | null;
  joinDate: string;
  isOwnProfile: boolean;
}

export function ProfileHeader({ userId, name, avatarUrl, joinDate, isOwnProfile }: ProfileHeaderProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 mb-8 overflow-hidden">
        {/* Banner */}
        <div className="h-32 sm:h-48 bg-gradient-to-br from-gray-900 to-black relative flex items-center justify-center">
          <span className="text-3xl sm:text-5xl font-black text-white opacity-90 tracking-widest">
            Raymarkable
          </span>
        </div>
        
        {/* Avatar & Edit Button Row */}
        <div className="px-6 relative flex justify-between items-start">
          <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gray-100 dark:bg-zinc-800 border-4 border-white dark:border-zinc-900 rounded-full flex items-center justify-center text-gray-400 dark:text-zinc-500 overflow-hidden absolute -top-12 sm:-top-16 left-6">
            {avatarUrl ? (
              <Image 
                src={avatarUrl} 
                alt={name || "Profile Picture"} 
                fill
                priority
                sizes="(max-width: 640px) 96px, 128px"
                className="object-cover"
              />
            ) : (
              <User className="w-12 h-12" />
            )}
          </div>
          
          <div className="w-24 sm:w-32 h-12 sm:h-16"></div>
          
          {isOwnProfile && (
            <button 
              onClick={() => setIsEditModalOpen(true)}
              className="mt-4 flex items-center gap-2 px-4 py-1.5 border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 text-sm font-bold text-gray-900 dark:text-white transition-colors cursor-pointer"
            >
              Edit profile
            </button>
          )}
        </div>
        
        {/* User Info */}
        <div className="px-6 pb-6 mt-2">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{name || "Unknown User"}</h1>
        
          <div className="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400 mt-3 text-sm font-medium">
            <span>Joined {joinDate}</span>
          </div>
        </div>
      </div>

      <EditProfileModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        userId={userId}
        currentName={name}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
