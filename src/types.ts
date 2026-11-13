export type TimelineMoment = { title: string; date: string; description: string; photoId?: string };
export type Reason = { title: string; message: string };
export type Writeup = { title: string; date: string; text: string };

export type SiteContent = {
  startDate: string;
  anniversaryDate: string;
  herName: string;
  yourName: string;
  letter: string;
  secret: string;
  timeline: TimelineMoment[];
  reasons: Reason[];
  writeups: Writeup[];
};
