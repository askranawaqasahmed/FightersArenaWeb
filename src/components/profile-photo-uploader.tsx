"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MediaUploadField } from "./media-upload-field";

export function ProfilePhotoUploader({ currentUrl, initials }: { currentUrl: string | null; initials: string }) {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState(currentUrl);

  return (
    <div className="profile-photo-uploader">
      <div className="avatar player-avatar profile-photo" role="img" aria-label="Profile picture" style={imageUrl ? { backgroundImage: `url("${imageUrl}")` } : undefined}>
        {!imageUrl && initials}
      </div>
      <MediaUploadField
        purpose="profile-picture"
        label="Profile picture"
        accept="image/png,image/jpeg,image/webp,image/gif"
        altText={`${initials} profile picture`}
        onUploaded={(media) => { setImageUrl(media.url); router.refresh(); }}
      />
    </div>
  );
}
