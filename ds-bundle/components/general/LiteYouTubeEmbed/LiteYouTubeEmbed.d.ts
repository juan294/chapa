import * as React from 'react';

/**
 * LiteYouTubeEmbed — from @chapa/web@2.24.1.
 */
export interface LiteYouTubeEmbedProps {
/** YouTube video ID (the part after v= in the URL) */
  videoId: string;
  /** Accessible title for the iframe and play button */
  title: string;
}

export declare const LiteYouTubeEmbed: React.ComponentType<LiteYouTubeEmbedProps>;
