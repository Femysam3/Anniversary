import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown, ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, Heart,
  ImagePlus, Music2, Pause, Pencil, Play, Plus, Settings2, SkipBack, SkipForward,
  Sparkles, Trash2, Volume2, X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { getMedia, removeMedia, saveMedia } from './storage';
import type { SavedMedia } from './storage';
import { deleteRemoteMedia, getRemoteMediaUrl, loadRemoteContent, loadRemoteMedia, saveRemoteContent, supabase, updateRemoteMedia, uploadRemoteMedia } from './cloud';
import type { MediaRow } from './cloud';
import type { Reason, SiteContent, TimelineMoment, Writeup } from './types';

type GalleryItem = Omit<SavedMedia, 'blob'> & { url: string; blob?: Blob; remote?: MediaRow };

const defaultContent: SiteContent = {
  startDate: '2025-11-14T00:00',
  anniversaryDate: '2026-11-14',
  herName: 'Favourite Person',
  yourName: 'Your person',
  letter: 'A year ago, I had no idea that one hello would become my favourite part of every day. Somehow, ordinary moments became the ones I want to keep forever: the conversations that run late, the laughter we cannot stop, and the quiet comfort of simply being beside you.\n\nThank you for being exactly who you are. You make the world feel softer, brighter, and so much more like home. If I could choose again, in every lifetime and every little moment, I would still choose you.',
  secret: 'If I could relive one year a thousand times, I would want every version to lead me right back to you. You are my favourite hello, my safest place, and the best thing that ever happened to an ordinary day. I love you — always.',
  timeline: [
    { title: 'The day we first met', date: 'Add your date', description: 'Every great story has a first page. Add how your story began.' },
    { title: 'Our first conversation', date: 'Add your date', description: 'A few words that somehow turned into everything.' },
    { title: 'Our first date', date: 'Add your date', description: 'The place, the butterflies, and the moment you wished the evening would last a little longer.' },
    { title: 'When I knew you were special', date: 'Add your date', description: 'That little moment when something just felt different.' },
    { title: 'Our funniest memory', date: 'Add your date', description: 'The story that still makes you both laugh.' },
    { title: 'A moment I will never forget', date: 'Add your date', description: 'One of those memories you want to keep close forever.' },
    { title: 'One beautiful year together', date: 'Today', description: 'And somehow, this is only the beginning.' },
  ],
  reasons: [
    { title: 'Your beautiful smile', message: 'It has this way of making even the most ordinary day feel like my favourite one.' },
    { title: 'The way you make me laugh', message: 'There is no one I would rather share a completely ridiculous joke with.' },
    { title: 'Your kind heart', message: 'You notice the little things and make people feel cared for just by being you.' },
    { title: 'How you make the ordinary special', message: 'A quiet day, a little walk, a conversation with you — somehow, it all becomes a memory.' },
    { title: 'The peace I feel with you', message: 'With you, I can just be myself. That is one of the most precious gifts.' },
    { title: 'Everything that makes you, you', message: 'I could fill every page in this little book and still have a million reasons left.' },
  ],
  writeups: [],
};

function readContent(): SiteContent {
  try {
    const saved = localStorage.getItem('anniversary-content');
    if (!saved) return defaultContent;
    const parsed = JSON.parse(saved) as Partial<SiteContent>;
    return { ...defaultContent, ...parsed, writeups: parsed.writeups ?? [] };
  } catch {
    return defaultContent;
  }
}

const formatDate = (date: string) => {
  if (!date || date === 'Today' || date === 'Add your date') return date;
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

function App() {
  const [content, setContent] = useState<SiteContent>(() => supabase ? defaultContent : readContent());
  const [entered, setEntered] = useState(false);
  const [opening, setOpening] = useState(false);
  const [surpriseOpened, setSurpriseOpened] = useState(false);
  const [activeReason, setActiveReason] = useState<number | null>(null);
  const [activePhoto, setActivePhoto] = useState<GalleryItem | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioTracks, setAudioTracks] = useState<GalleryItem[]>([]);
  const [currentTrackId, setCurrentTrackId] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let active = true;
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      if (active) setIsOwner(Boolean(session));
    }).data.subscription;
    void (async () => {
      try {
        if (supabase) {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          if (active) setIsOwner(Boolean(sessionData.session));
          const [remoteContent, records] = await Promise.all([loadRemoteContent(), loadRemoteMedia()]);
          if (!active) return;
          if (remoteContent) setContent({ ...defaultContent, ...remoteContent, writeups: remoteContent.writeups ?? [] });
          const remoteItems = records.map((record) => ({
            id: record.id,
            name: record.name,
            type: record.type,
            caption: record.caption,
            date: record.date,
            description: record.description,
            createdAt: new Date(record.created_at).getTime(),
            remote: record,
            url: getRemoteMediaUrl(record.storage_path),
          }));
          const imagesAndVideos = remoteItems.filter((item) => item.type !== 'audio');
          const tracks = remoteItems.filter((item) => item.type === 'audio');
          setGallery(imagesAndVideos);
          setAudioTracks(tracks);
          if (tracks[0]) setCurrentTrackId(tracks[0].id);
        } else {
          const items = await getMedia();
          if (!active) return;
          const galleryItems = items.filter((item) => item.type !== 'audio').map((item) => {
            if (!item.blob) throw new Error(`The saved file ${item.name} is missing.`);
            return { ...item, url: URL.createObjectURL(item.blob) };
          });
          const savedTracks = items.filter((item) => item.type === 'audio').map((item) => {
            if (!item.blob) throw new Error(`The saved file ${item.name} is missing.`);
            return { ...item, url: URL.createObjectURL(item.blob) };
          });
          setGallery(galleryItems);
          setAudioTracks(savedTracks);
          if (savedTracks[0]) setCurrentTrackId(savedTracks[0].id);
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load your shared story.');
      } finally {
        if (active) setLoadingMedia(false);
      }
    })();
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      active = false;
      subscription?.unsubscribe();
      window.clearInterval(timer);
    };
  }, []);

  const currentTrack = audioTracks.find((track) => track.id === currentTrackId);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    audio.src = currentTrack.url;
    if (isPlaying) void audio.play().catch(() => setIsPlaying(false));
  }, [currentTrackId, currentTrack, isPlaying]);

  useEffect(() => {
    if (!entered) return;
    document.body.classList.add('experience-open');
    return () => document.body.classList.remove('experience-open');
  }, [entered]);

  const elapsed = useMemo(() => {
    const start = new Date(content.startDate).getTime();
    const total = Math.max(0, now - (Number.isNaN(start) ? now : start));
    return {
      days: Math.floor(total / 86_400_000),
      hours: Math.floor((total / 3_600_000) % 24),
      minutes: Math.floor((total / 60_000) % 60),
      seconds: Math.floor((total / 1000) % 60),
    };
  }, [content.startDate, now]);

  async function updateContent(next: SiteContent) {
    if (supabase) {
      if (!isOwner) throw new Error('Sign in as the site owner before saving shared changes.');
      await saveRemoteContent(next);
    } else {
      localStorage.setItem('anniversary-content', JSON.stringify(next));
    }
    setContent(next);
  }

  function requestMediaUpload() {
    if (supabase && !isOwner) {
      setShowSettings(true);
      return;
    }
    fileInputRef.current?.click();
  }

  function requestMusicUpload() {
    if (supabase && !isOwner) {
      setShowSettings(true);
      return;
    }
    musicInputRef.current?.click();
  }

  async function signInOwner(email: string, password: string) {
    if (!supabase) throw new Error('Supabase is not configured for this website.');
    setSigningIn(true);
    setSignInError('');
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not sign in.';
      setSignInError(message);
      throw cause;
    } finally {
      setSigningIn(false);
    }
  }

  async function signOutOwner() {
    if (!supabase) return;
    const { error: authError } = await supabase.auth.signOut();
    if (authError) setError(`Could not sign out: ${authError.message}`);
    else setShowSettings(false);
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    if (supabase && !isOwner) {
      setShowSettings(true);
      return;
    }
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    setError('');
    for (const file of files) {
      const type = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : null;
      if (!type) {
        setError(`${file.name} is not a supported image or video.`);
        continue;
      }
      if (file.size > 80 * 1024 * 1024) {
        setError(`${file.name} is over 80 MB. Choose a smaller file.`);
        continue;
      }
      try {
        if (supabase) {
          const record = await uploadRemoteMedia(file, type);
          const item: GalleryItem = {
            id: record.id, name: record.name, type: record.type, caption: record.caption, date: record.date,
            description: record.description, createdAt: new Date(record.created_at).getTime(),
            remote: record, url: getRemoteMediaUrl(record.storage_path),
          };
          setGallery((current) => [item, ...current]);
        } else {
          const item: SavedMedia = {
            id: crypto.randomUUID(), name: file.name, type, caption: '', date: '',
            description: '', blob: file, createdAt: Date.now(),
          };
          await saveMedia(item);
          setGallery((current) => [{ ...item, url: URL.createObjectURL(file) }, ...current]);
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not save your file in this browser.');
      }
    }
  }

  async function handleMusicUpload(event: ChangeEvent<HTMLInputElement>) {
    if (supabase && !isOwner) {
      setShowSettings(true);
      return;
    }
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    let remaining = Math.max(0, 10 - audioTracks.length);
    setError('');
    for (const file of files) {
      if (!file.type.startsWith('audio/')) {
        setError(`${file.name} is not a supported audio file.`);
        continue;
      }
      if (remaining === 0) {
        setError('You can save up to 10 songs. Remove a song to make room for another.');
        break;
      }
      if (file.size > 80 * 1024 * 1024) {
        setError(`${file.name} is over 80 MB. Choose a smaller file.`);
        continue;
      }
      try {
        let track: GalleryItem;
        if (supabase) {
          const record = await uploadRemoteMedia(file, 'audio');
          track = {
            id: record.id, name: record.name, type: record.type, caption: record.caption, date: record.date,
            description: record.description, createdAt: new Date(record.created_at).getTime(),
            remote: record, url: getRemoteMediaUrl(record.storage_path),
          };
        } else {
          const item: SavedMedia = {
            id: crypto.randomUUID(), name: file.name, type: 'audio',
            caption: file.name.replace(/\.[^.]+$/, ''), date: '', description: '', blob: file, createdAt: Date.now(),
          };
          await saveMedia(item);
          track = { ...item, url: URL.createObjectURL(file) };
        }
        setAudioTracks((tracks) => [...tracks, track]);
        if (!currentTrackId) setCurrentTrackId(track.id);
        remaining -= 1;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not save your music.');
      }
    }
  }

  async function saveTrackTitle(track: GalleryItem, title: string) {
    const updated = { ...track, caption: title };
    try {
      if (supabase && track.remote) {
        await updateRemoteMedia(track.id, { caption: title, date: track.date, description: track.description });
      } else {
        if (!track.blob) throw new Error('This saved song is missing its audio file.');
        await saveMedia({ ...updated, blob: track.blob });
      }
      setAudioTracks((tracks) => tracks.map((item) => item.id === track.id ? updated : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the song title.');
    }
  }

  async function deleteTrack(track: GalleryItem) {
    try {
      if (supabase && track.remote) await deleteRemoteMedia(track.remote);
      else await removeMedia(track.id);
      URL.revokeObjectURL(track.url);
      const remainingTracks = audioTracks.filter((item) => item.id !== track.id);
      setAudioTracks(remainingTracks);
      if (track.id === currentTrackId) {
        setIsPlaying(false);
        setCurrentTrackId(remainingTracks[0]?.id ?? '');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove this song.');
    }
  }

  async function deleteItem(item: GalleryItem) {
    try {
      if (supabase && item.remote) await deleteRemoteMedia(item.remote);
      else await removeMedia(item.id);
      if (!supabase) URL.revokeObjectURL(item.url);
      setGallery((current) => current.filter((entry) => entry.id !== item.id));
      if (activePhoto?.id === item.id) setActivePhoto(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove this memory.');
    }
  }

  async function saveCaption(id: string, field: 'caption' | 'date' | 'description', value: string) {
    const current = gallery.find((item) => item.id === id);
    if (!current) return;
    const updated = { ...current, [field]: value };
    try {
      if (supabase && current.remote) {
        await updateRemoteMedia(id, {
          caption: updated.caption,
          date: updated.date,
          description: updated.description,
        });
      } else {
        if (!updated.blob) throw new Error('This saved memory is missing its file.');
        await saveMedia({ ...updated, blob: updated.blob });
      }
      setGallery((items) => items.map((item) => item.id === id ? updated : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this caption.');
    }
  }

  function toggleMusic() {
    const audio = audioRef.current;
    if (!audioTracks.length) {
      requestMusicUpload();
      return;
    }
    if (isPlaying && audio) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (!currentTrack && audioTracks[0]) setCurrentTrackId(audioTracks[0].id);
      if (audio && currentTrack) {
        audio.src = currentTrack.url;
        void audio.play().then(() => setIsPlaying(true)).catch(() => setError('Your browser could not play this audio file.'));
      } else {
        setIsPlaying(true);
      }
    }
  }

  function skipTrack(direction: -1 | 1) {
    if (!audioTracks.length) {
      requestMusicUpload();
      return;
    }
    const index = audioTracks.findIndex((track) => track.id === currentTrackId);
    const nextIndex = index < 0
      ? (direction === 1 ? 0 : audioTracks.length - 1)
      : (index + direction + audioTracks.length) % audioTracks.length;
    const next = audioTracks[nextIndex];
    if (!next) return;
    setCurrentTrackId(next.id);
    setIsPlaying(true);
  }

  function handleTrackEnded() {
    if (audioTracks.length > 1) skipTrack(1);
    else setIsPlaying(false);
  }

  return (
    <>
      <audio ref={audioRef} onEnded={handleTrackEnded} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />
      <input ref={musicInputRef} className="sr-only" type="file" accept="audio/*" multiple onChange={handleMusicUpload} />
      <AnimatePresence mode="wait">
        {!entered ? (
          <motion.main className="intro-screen" key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.03 }} transition={{ duration: 1 }}>
            <div className="intro-grain" />
            <div className="intro-orb intro-orb-one" /><div className="intro-orb intro-orb-two" />
            <motion.div className="intro-content" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: .3, duration: 1 }}>
              <span className="eyebrow intro-eyebrow"><span className="tiny-star">✳</span> A little something, just for you <span className="tiny-star">✳</span></span>
              <h1>To My<br /><em>{content.herName}</em> <span className="title-heart">♥</span></h1>
              <p className="intro-copy">One year of love, laughter, beautiful memories<br className="desktop-break" /> and a thousand reasons to choose you again.</p>
              <motion.div className={`envelope ${opening ? 'envelope-opening' : ''}`} animate={!opening ? { y: [0, -7, 0], rotate: [0, .6, 0] } : { y: -7, rotate: 0 }} transition={{ duration: 4, repeat: opening ? 0 : Infinity, ease: 'easeInOut' }}>
                <div className="envelope-card"><Heart size={20} fill="currentColor" strokeWidth={0} /></div>
                <div className="envelope-back" /><div className="envelope-flap" /><div className="envelope-front" />
              </motion.div>
              <button className="button button-cream intro-button" disabled={opening} onClick={() => { setOpening(true); window.setTimeout(() => setEntered(true), 850); }}>{opening ? 'A little note for you…' : 'Open your surprise'} <Heart size={15} /></button>
              <span className="intro-footnote">best opened slowly, somewhere cosy</span>
            </motion.div>
            <div className="intro-bottom"><span>MADE WITH ALL MY LOVE</span><span>✦ &nbsp; ONE YEAR &nbsp; ✦</span></div>
          </motion.main>
        ) : (
          <motion.div className="experience" key="experience" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
            <nav className="topbar">
              <a className="brand" href="#home" aria-label="Back to the beginning"><span className="brand-mark">♥</span> our little story<span className="brand-dot">.</span></a>
              <div className="nav-links"><a href="#story">Our story</a><a href="#memories">Memories</a><a href="#reasons">A few reasons</a>{content.writeups.length > 0 && <a href="#writeups">Little notes</a>}<a href="#letter">The letter</a></div>
              <button className="icon-button settings-button" aria-label="Edit your anniversary details" onClick={() => setShowSettings(true)}><Settings2 size={17} /><span>Make it yours</span></button>
            </nav>

            <main id="home">
              <section className="hero-section">
                <div className="hero-sunwash" />
                <div className="hero-content">
                  <motion.span className="eyebrow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .15 }}>A YEAR OF US &nbsp;·&nbsp; {formatDate(content.anniversaryDate)}</motion.span>
                  <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .28, duration: .8 }}>One year,<br /><em>a thousand little things.</em></motion.h1>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .6 }}>For {content.herName} — my favourite person, my best days, my always.</motion.p>
                  <motion.a className="scroll-cue" href="#story" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}><span>TAKE A LITTLE WALK WITH ME</span><ArrowDown size={16} /></motion.a>
                </div>
                <div className="hero-side-note">A LITTLE LOVE LETTER<br />FROM {content.yourName.toUpperCase()}</div>
                <div className="hero-stamp"><span>EST.</span><strong>US</strong><span>♡ FOREVER</span></div>
              </section>

              <section id="story" className="section story-section">
                <div className="section-heading centered">
                  <span className="eyebrow">CHAPTER ONE &nbsp;·&nbsp; THE BEGINNING</span>
                  <h2>How our story <em>began</em></h2>
                  <p>Every favourite story has a beginning. Here's ours.</p>
                </div>
                <div className="timeline">
                  <div className="timeline-line"><motion.div className="timeline-fill" initial={{ height: 0 }} whileInView={{ height: '100%' }} viewport={{ once: true, amount: .2 }} transition={{ duration: 1.8, ease: 'easeOut' }} /></div>
                  {content.timeline.map((moment, index) => (
                    <motion.article className={`timeline-item ${index % 2 ? 'timeline-right' : 'timeline-left'}`} key={`${moment.title}-${index}`} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .4 }} transition={{ duration: .65 }}>
                      <span className="timeline-dot"><Heart size={11} fill="currentColor" /></span>
                      <div className="timeline-card">
                        <span className="eyebrow timeline-date"><CalendarDays size={12} /> {formatDate(moment.date)}</span>
                        <h3>{moment.title}</h3><p>{moment.description}</p>
                        {moment.photoId && gallery.find((item) => item.id === moment.photoId) && <img className="timeline-photo" src={gallery.find((item) => item.id === moment.photoId)!.url} alt={`Photo for ${moment.title}`} />}
                        <div className="timeline-card-foot"><span>OUR STORY</span><span>{String(index + 1).padStart(2, '0')} <span className="gold-separator">/</span> {String(content.timeline.length).padStart(2, '0')}</span></div>
                      </div>
                    </motion.article>
                  ))}
                </div>
                <div className="section-endnote"><Heart size={13} fill="currentColor" /> and a thousand little moments in between</div>
              </section>

              <section id="memories" className="section gallery-section">
                <div className="section-heading gallery-heading">
                  <div><span className="eyebrow">CHAPTER TWO &nbsp;·&nbsp; THE KEEPSAKES</span><h2>Little moments,<br /><em>kept forever.</em></h2></div>
                  <p>Our favourite days deserve a place to live.<br />Add the photos and videos that feel like <i>us.</i></p>
                </div>
                {error && <div className="error-banner" role="status">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={14} /></button></div>}
                <div className="gallery-toolbar">
                  <span><span className="gallery-count">{String(gallery.length).padStart(2, '0')}</span> MEMORIES &nbsp;·&nbsp; YOUR PRIVATE LITTLE GALLERY</span>
                  <button className="button button-dark upload-button" onClick={requestMediaUpload}><ImagePlus size={16} /> Add your photos</button>
                  <input ref={fileInputRef} className="sr-only" type="file" accept="image/*,video/*" multiple onChange={handleUpload} />
                </div>
                {loadingMedia ? <div className="gallery-empty"><div className="loading-ring" /><p>Gathering your memories…</p></div> : gallery.length ? (
                  <div className="masonry-grid">
                    {gallery.map((item, index) => (
                      <motion.article className={`memory-card memory-card-${index % 3}`} key={item.id} layout initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .4 }}>
                        <button className="memory-image" onClick={() => setActivePhoto(item)} aria-label={`Open ${item.caption || item.name}`}>
                          {item.type === 'video' ? <><video src={item.url} muted preload="metadata" /><span className="video-play"><Play size={18} fill="currentColor" /></span></> : <img src={item.url} alt={item.caption || 'A memory you added'} loading="lazy" />}
                          <span className="image-zoom"><Plus size={18} /></span>
                        </button>
                        <div className="memory-caption">
                          <input aria-label="Photo caption" readOnly={Boolean(supabase && !isOwner)} value={item.caption} placeholder="Give this memory a name…" onChange={(event) => {
                            const value = event.target.value;
                            setGallery((items) => items.map((memory) => memory.id === item.id ? { ...memory, caption: value } : memory));
                          }} onBlur={(event) => void saveCaption(item.id, 'caption', event.target.value)} />
                          <input className="caption-date" aria-label="Memory date" readOnly={Boolean(supabase && !isOwner)} type="text" value={item.date} placeholder="Add a date" onChange={(event) => {
                            const value = event.target.value;
                            setGallery((items) => items.map((memory) => memory.id === item.id ? { ...memory, date: value } : memory));
                          }} onBlur={(event) => void saveCaption(item.id, 'date', event.target.value)} />
                          <input className="caption-description" aria-label="Memory description" readOnly={Boolean(supabase && !isOwner)} type="text" value={item.description} placeholder="Add a little story…" onChange={(event) => {
                            const value = event.target.value;
                            setGallery((items) => items.map((memory) => memory.id === item.id ? { ...memory, description: value } : memory));
                          }} onBlur={(event) => void saveCaption(item.id, 'description', event.target.value)} />
                          {(!supabase || isOwner) && <button className="delete-memory" aria-label="Remove memory" onClick={() => void deleteItem(item)}><Trash2 size={14} /></button>}
                        </div>
                      </motion.article>
                    ))}
                    <button className="add-memory-tile" onClick={requestMediaUpload}><Plus size={20} /><span>There are more moments to keep</span><small>ADD ANOTHER MEMORY</small></button>
                  </div>
                ) : (
                  <div className="gallery-empty">
                    <div className="empty-stack"><div className="empty-polaroid polaroid-back" /><div className="empty-polaroid polaroid-mid" /><div className="empty-polaroid polaroid-front"><ImagePlus size={22} /><span>your photo here</span></div></div>
                    <h3>Your memories belong here.</h3>
                    <p>No stock photos, no made-up moments — just the ones that are yours.</p>
                    <button className="text-button" onClick={requestMediaUpload}>Add your first photo or video <ArrowRight size={15} /></button>
                  </div>
                )}
                <p className="privacy-note"><span className="privacy-dot" /> Your memories stay in this browser, on this device.</p>
              </section>

              <section className="counter-section">
                <div className="counter-glow" />
                <span className="eyebrow">EVERY LITTLE SECOND COUNTS</span>
                <h2><em>{elapsed.days}</em> days of loving you.</h2>
                <div className="counter-grid">
                  {[['DAYS', elapsed.days], ['HOURS', elapsed.hours], ['MINUTES', elapsed.minutes], ['SECONDS', elapsed.seconds]].map(([label, value]) => (
                    <div className="counter-unit" key={label}><motion.span key={String(value)} initial={{ opacity: .35, y: -4 }} animate={{ opacity: 1, y: 0 }} className="counter-value">{String(value).padStart(2, '0')}</motion.span><span className="counter-label">{label}</span></div>
                  ))}
                </div>
                <p>Every second with you has been a memory worth keeping.</p>
                <button className="counter-edit" onClick={() => setShowSettings(true)}><Pencil size={12} /> EDIT OUR START DATE</button>
              </section>

              <section id="reasons" className="section reasons-section">
                <div className="section-heading centered">
                  <span className="eyebrow">CHAPTER THREE &nbsp;·&nbsp; A LITTLE LIST</span>
                  <h2>A few of the <em>million</em><br />reasons I love you.</h2>
                  <p>Tap one. I could keep going for a while.</p>
                </div>
                <div className="reasons-grid">
                  {content.reasons.map((reason, index) => (
                    <motion.button className={`reason-card ${activeReason === index ? 'reason-active' : ''}`} key={`${reason.title}-${index}`} onClick={() => setActiveReason(activeReason === index ? null : index)} whileHover={{ y: -5 }} whileTap={{ scale: .98 }} aria-expanded={activeReason === index}>
                      <span className="reason-number">0{index + 1} <span>—</span> A REASON</span>
                      <span className="reason-heart"><Heart size={17} fill={activeReason === index ? 'currentColor' : 'none'} /></span>
                      <span className="reason-title">{reason.title}</span>
                      <AnimatePresence>{activeReason === index && <motion.span className="reason-message" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: .3 }}>{reason.message}</motion.span>}</AnimatePresence>
                      <span className="reason-hint">{activeReason === index ? 'A LITTLE MORE' : 'TAP TO FIND OUT'} <ChevronDown size={12} className={activeReason === index ? 'rotate-icon' : ''} /></span>
                    </motion.button>
                  ))}
                </div>
                <div className="reasons-note"><span>there are approximately</span> <strong>a million</strong> <span>more.</span></div>
              </section>

              {content.writeups.length > 0 && <section id="writeups" className="writeups-section">
                <div className="section-heading centered">
                  <span className="eyebrow">A FEW MORE WORDS, JUST FOR YOU</span>
                  <h2>Little notes, <em>from my heart.</em></h2>
                  <p>The thoughts, stories, and things I never want you to forget.</p>
                </div>
                <div className="writeups-list">
                  {content.writeups.map((writeup, index) => <motion.article className="writeup-card" key={`writeup-${index}`} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .25 }} transition={{ duration: .55 }}>
                    <span className="writeup-number">{String(index + 1).padStart(2, '0')} <span>—</span> A LITTLE NOTE</span>
                    <h3>{writeup.title}</h3>
                    {writeup.date && <span className="writeup-date"><CalendarDays size={12} /> {formatDate(writeup.date)}</span>}
                    <p>{writeup.text}</p>
                  </motion.article>)}
                </div>
              </section>}

              <section id="letter" className="letter-section">
                <div className="letter-wash" />
                <div className="letter-heading"><span className="eyebrow">CHAPTER FOUR &nbsp;·&nbsp; FROM THE HEART</span><h2>Something I want<br /><em>you to know…</em></h2></div>
                <Letter text={`${content.letter}\n\nThank you for making my first year with you unforgettable. Here's to many more years of choosing each other. I love you. ❤️`} signature={content.yourName} />
              </section>

              <section className="surprise-section">
                <span className="eyebrow">CHAPTER FIVE &nbsp;·&nbsp; ONE LAST THING</span>
                <h2>One last little <em>surprise…</em></h2>
                <p>Because one year of us deserves a little extra magic.</p>
                <motion.button className={`gift-box ${surpriseOpened ? 'gift-open' : ''}`} onClick={() => setSurpriseOpened(true)} disabled={surpriseOpened} whileHover={!surpriseOpened ? { y: -8, rotate: -2 } : {}} whileTap={!surpriseOpened ? { scale: .96 } : {}} aria-label="Open your anniversary surprise">
                  <span className="gift-bow"><span /><span /></span><span className="gift-lid" /><span className="gift-body"><span className="gift-ribbon" /></span><span className="gift-glow" />
                </motion.button>
                <AnimatePresence>
                  {surpriseOpened ? (
                    <motion.div className="surprise-reveal" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7 }}>
                      <span className="eyebrow"><Sparkles size={13} /> JUST FOR YOU <Sparkles size={13} /></span>
                      <p>{content.secret}</p>
                      {gallery.find((item) => item.type === 'image') && <button className="surprise-photo" onClick={() => setActivePhoto(gallery.find((item) => item.type === 'image')!)}><img src={gallery.find((item) => item.type === 'image')!.url} alt="A favourite photo you added" /><span>OUR FAVOURITE</span></button>}
                      <div className="confetti-field" aria-hidden="true">{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties}>{i % 3 === 0 ? '♥' : '✦'}</i>)}</div>
                    </motion.div>
                  ) : <button className="text-button gift-hint" onClick={() => setSurpriseOpened(true)}>Go on, open it <ArrowRight size={15} /></button>}
                </AnimatePresence>
              </section>

              <section className="closing-section">
                <div className="closing-orbit orbit-one" /><div className="closing-orbit orbit-two" />
                <div className="closing-content">
                  {gallery.find((item) => item.type === 'image') ? <button className="closing-photo" onClick={() => setActivePhoto(gallery.find((item) => item.type === 'image')!)}><img src={gallery.find((item) => item.type === 'image')!.url} alt="A favourite photo you added" /><span>OUR LITTLE WORLD</span></button> : <div className="closing-photo-empty"><Heart size={25} /><span>OUR LITTLE WORLD</span></div>}
                  <span className="eyebrow">AND THIS IS ONLY THE BEGINNING</span>
                  <h2>Happy first anniversary,<br /><em>{content.herName}.</em> <span className="closing-heart">♥</span></h2>
                  <p>One year down, forever to go.</p>
                  <p className="closing-from">With all my love, {content.yourName}</p>
                  <div className="closing-date"><span>OUR DAY</span><strong>{formatDate(content.anniversaryDate)}</strong></div>
                  <button className="button button-cream replay-button" onClick={() => { setEntered(false); setSurpriseOpened(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><ArrowLeft size={15} /> Take me back to the beginning</button>
                </div>
                <div className="closing-footer"><span>MADE WITH ALL MY LOVE, ALWAYS</span><Heart size={12} fill="currentColor" /><span>JUST FOR YOU</span></div>
              </section>
            </main>

            <div className="music-player">
              <button className={`music-control ${isPlaying ? 'music-playing' : ''}`} onClick={toggleMusic} aria-label={audioTracks.length ? (isPlaying ? 'Pause music' : 'Play music') : 'Add songs'}>
                <span className="music-disc"><Music2 size={16} /></span><span>{audioTracks.length ? (currentTrack?.caption || currentTrack?.name || 'OUR SONGS') : 'ADD OUR SONGS'}</span>{audioTracks.length > 0 && (isPlaying ? <Pause size={13} /> : <Play size={13} />)}
              </button>
              {audioTracks.length > 1 && <div className="music-skip-controls">
                <button onClick={() => skipTrack(-1)} aria-label="Previous song"><SkipBack size={13} /></button>
                <span>{audioTracks.findIndex((track) => track.id === currentTrackId) + 1}/{audioTracks.length}</span>
                <button onClick={() => skipTrack(1)} aria-label="Next song"><SkipForward size={13} /></button>
              </div>}
              <button className="music-add-control" onClick={requestMusicUpload} aria-label={audioTracks.length >= 10 ? 'Maximum of 10 songs reached' : 'Add songs'} disabled={audioTracks.length >= 10}><Plus size={14} /></button>
              <span className="music-note"><Volume2 size={12} /> {audioTracks.length}/10 songs · only plays when you choose</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && supabase && !isOwner && <OwnerLoginModal error={signInError} isSubmitting={signingIn} onClose={() => setShowSettings(false)} onSignIn={signInOwner} />}
        {showSettings && (!supabase || isOwner) && <SettingsModal content={content} gallery={gallery.filter((item) => item.type === 'image')} tracks={audioTracks} cloudEnabled={Boolean(supabase)} onAddMusic={requestMusicUpload} onSaveTrackTitle={saveTrackTitle} onDeleteTrack={deleteTrack} onSignOut={supabase ? signOutOwner : undefined} onClose={() => setShowSettings(false)} onSave={updateContent} />}
        {activePhoto && <Lightbox item={activePhoto} editable={!supabase || isOwner} onClose={() => setActivePhoto(null)} onCaption={(value) => void saveCaption(activePhoto.id, 'caption', value)} />}
      </AnimatePresence>
    </>
  );
}

function Letter({ text, signature }: { text: string; signature: string }) {
  const [visible, setVisible] = useState(false);
  const [typed, setTyped] = useState('');
  const reduced = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const reveal = () => setVisible(true);
    const element = document.getElementById('letter');
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { reveal(); observer.disconnect(); } }, { threshold: .22 });
    if (element) observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    if (reduced.current) { setTyped(text); return; }
    let index = 0;
    const timer = window.setInterval(() => {
      index = Math.min(index + 3, text.length);
      setTyped(text.slice(0, index));
      if (index >= text.length) window.clearInterval(timer);
    }, 22);
    return () => window.clearInterval(timer);
  }, [text, visible]);
  return (
    <motion.article className="letter-paper" initial={{ opacity: 0, y: 28, rotate: 1 }} whileInView={{ opacity: 1, y: 0, rotate: 0 }} viewport={{ once: true, amount: .2 }} transition={{ duration: .8 }}>
      <div className="letter-paper-top"><span>A LETTER FOR YOU</span><Heart size={14} fill="currentColor" /></div>
      <p className="letter-salutation">My love,</p>
      <p className="letter-copy">{typed}<span className={`type-cursor ${typed.length >= text.length ? 'cursor-hidden' : ''}`}>|</span></p>
      <div className="letter-signoff">With all my heart,</div>
      <div className="signature">{signature}</div>
      <div className="letter-paper-bottom"><span>ALWAYS & FOREVER</span><span>♡</span></div>
    </motion.article>
  );
}

function Lightbox({ item, editable, onClose, onCaption }: { item: GalleryItem; editable: boolean; onClose: () => void; onCaption: (value: string) => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', closeOnEscape); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <motion.div className="lightbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <button className="lightbox-close" onClick={onClose} aria-label="Close photo"><X /></button>
      <motion.div className="lightbox-content" initial={{ scale: .95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: .97 }} onClick={(event) => event.stopPropagation()}>
        {item.type === 'video' ? <video src={item.url} controls autoPlay /> : <img src={item.url} alt={item.caption || 'A memory you added'} />}
        <div className="lightbox-caption"><input aria-label="Memory caption" readOnly={!editable} defaultValue={item.caption} placeholder="A little name for this memory…" onBlur={(event) => onCaption(event.target.value)} /><span>{item.date}</span></div>
      </motion.div>
    </motion.div>
  );
}

function OwnerLoginModal({ error, isSubmitting, onClose, onSignIn }: {
  error: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSignIn: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLocalError('');
    try {
      await onSignIn(email, password);
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Sign-in failed.');
    }
  }

  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form className="owner-login-modal" onSubmit={(event) => void submit(event)} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="icon-button login-close" onClick={onClose} aria-label="Close sign-in"><X size={18} /></button>
        <span className="eyebrow">YOUR LITTLE CORNER OF THE INTERNET</span>
        <h2>Sign in to make edits</h2>
        <p>Her memories are here for everyone to see, but only you can change the story.</p>
        <label>Email address<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {(localError || error) && <div className="login-error" role="alert">{localError || error}</div>}
        <button className="button button-dark login-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in securely'}</button>
        <span className="login-footnote">The site owner creates this login in the Supabase dashboard.</span>
      </motion.form>
    </motion.div>
  );
}

function SettingsModal({ content, gallery, tracks, cloudEnabled, onAddMusic, onSaveTrackTitle, onDeleteTrack, onSignOut, onClose, onSave }: {
  content: SiteContent;
  gallery: GalleryItem[];
  tracks: GalleryItem[];
  cloudEnabled: boolean;
  onAddMusic: () => void;
  onSaveTrackTitle: (track: GalleryItem, title: string) => Promise<void>;
  onDeleteTrack: (track: GalleryItem) => Promise<void>;
  onSignOut?: () => Promise<void>;
  onClose: () => void;
  onSave: (content: SiteContent) => Promise<void>;
}) {
  const [draft, setDraft] = useState<SiteContent>(() => structuredClone(content));
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', closeOnEscape); document.body.style.overflow = ''; };
  }, [onClose]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      await onSave(draft);
      setSaved(true);
      window.setTimeout(onClose, 650);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Could not save your story.');
    } finally {
      setSaving(false);
    }
  }
  function updateMoment(index: number, patch: Partial<TimelineMoment>) {
    setDraft((current) => ({ ...current, timeline: current.timeline.map((item, i) => i === index ? { ...item, ...patch } : item) }));
  }
  function updateReason(index: number, patch: Partial<Reason>) {
    setDraft((current) => ({ ...current, reasons: current.reasons.map((item, i) => i === index ? { ...item, ...patch } : item) }));
  }
  function updateWriteup(index: number, patch: Partial<Writeup>) {
    setDraft((current) => ({ ...current, writeups: current.writeups.map((item, i) => i === index ? { ...item, ...patch } : item) }));
  }
  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form className="settings-modal" onSubmit={(event) => void submit(event)} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><span className="eyebrow">MAKE THIS LITTLE STORY YOURS</span><h2>A few little details</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close settings"><X size={18} /></button></div>
        <p className="modal-intro">{cloudEnabled ? 'Edits and media are shared with your partner and saved to your private Supabase project.' : 'Everything saves in this browser. Photos, videos, and songs stay right here on this device, too.'}</p>
        <div className="settings-fields">
          <label>Her name<input value={draft.herName} onChange={(e) => setDraft({ ...draft, herName: e.target.value })} /></label>
          <label>Your name<input value={draft.yourName} onChange={(e) => setDraft({ ...draft, yourName: e.target.value })} /></label>
          <label>When your story began<input type="datetime-local" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} required /></label>
          <label>Your anniversary date<input type="date" value={draft.anniversaryDate} onChange={(e) => setDraft({ ...draft, anniversaryDate: e.target.value })} required /></label>
        </div>
        <div className="settings-subheading"><CalendarDays size={15} /> YOUR TIMELINE <small>edit a memory or add another</small></div>
        {draft.timeline.map((item, index) => (
          <div className="settings-memory" key={`timeline-${index}`}>
            <div className="settings-fields">
              <label>Moment<input value={item.title} onChange={(e) => updateMoment(index, { title: e.target.value })} /></label>
              <label>Date or date to remember<input value={item.date} onChange={(e) => updateMoment(index, { date: e.target.value })} /></label>
              <label>Photo from your gallery<select value={item.photoId ?? ''} onChange={(e) => updateMoment(index, { photoId: e.target.value || undefined })}><option value="">No photo selected</option>{gallery.map((photo) => <option value={photo.id} key={photo.id}>{photo.caption || photo.name}</option>)}</select></label>
              <label className="field-full">The story<textarea value={item.description} onChange={(e) => updateMoment(index, { description: e.target.value })} rows={2} /></label>
            </div>
            <button type="button" className="remove-row" onClick={() => setDraft({ ...draft, timeline: draft.timeline.filter((_, i) => i !== index) })}><Trash2 size={13} /> Remove this moment</button>
          </div>
        ))}
        <button type="button" className="add-row-button" onClick={() => setDraft({ ...draft, timeline: [...draft.timeline, { title: 'A moment to remember', date: 'Add your date', description: 'Tell the little story behind this moment.' }] })}><Plus size={14} /> Add a timeline moment</button>
        <div className="settings-subheading"><Heart size={15} /> A FEW REASONS <small>add as many as you like</small></div>
        {draft.reasons.map((reason, index) => (
          <div className="settings-memory" key={`reason-${index}`}>
            <div className="settings-fields">
              <label>Reason<input value={reason.title} onChange={(e) => updateReason(index, { title: e.target.value })} /></label>
              <label>Why you love it<textarea value={reason.message} onChange={(e) => updateReason(index, { message: e.target.value })} rows={2} /></label>
            </div>
            <button type="button" className="remove-row" onClick={() => setDraft({ ...draft, reasons: draft.reasons.filter((_, i) => i !== index) })}><Trash2 size={13} /> Remove this reason</button>
          </div>
        ))}
        <button type="button" className="add-row-button" onClick={() => setDraft({ ...draft, reasons: [...draft.reasons, { title: 'One more reason', message: 'Tell her why this makes her wonderful.' }] })}><Plus size={14} /> Add a reason</button>
        <div className="settings-subheading"><Music2 size={15} /> YOUR SOUNDTRACK <small>{tracks.length} of 10 songs</small></div>
        <p className="modal-intro soundtrack-hint">Add your own romantic songs. Choose a title for each one; playback starts only when you press play.</p>
        {tracks.map((track) => (
          <div className="track-row" key={track.id}>
            <Music2 size={15} />
            <label>Song title<input defaultValue={track.caption || track.name} onBlur={(event) => void onSaveTrackTitle(track, event.target.value)} /></label>
            <button type="button" className="remove-row" onClick={() => void onDeleteTrack(track)} aria-label={`Remove ${track.caption || track.name}`}><Trash2 size={14} /></button>
          </div>
        ))}
        <button type="button" className="add-row-button" disabled={tracks.length >= 10} onClick={onAddMusic}><Plus size={14} /> {tracks.length >= 10 ? 'You have added the maximum 10 songs' : 'Add songs (up to 10 total)'}</button>
        <div className="settings-subheading"><Pencil size={15} /> YOUR EXTRA WRITEUPS <small>add as many notes and stories as you like</small></div>
        {draft.writeups.map((writeup, index) => (
          <div className="settings-memory" key={`writeup-${index}`}>
            <div className="settings-fields">
              <label>Title<input value={writeup.title} onChange={(e) => updateWriteup(index, { title: e.target.value })} /></label>
              <label>Date or occasion (optional)<input value={writeup.date} onChange={(e) => updateWriteup(index, { date: e.target.value })} /></label>
              <label className="field-full">Your words<textarea value={writeup.text} onChange={(e) => updateWriteup(index, { text: e.target.value })} rows={5} /></label>
            </div>
            <button type="button" className="remove-row" onClick={() => setDraft({ ...draft, writeups: draft.writeups.filter((_, i) => i !== index) })}><Trash2 size={13} /> Remove this writeup</button>
          </div>
        ))}
        <button type="button" className="add-row-button" onClick={() => setDraft({ ...draft, writeups: [...draft.writeups, { title: 'A little note for you', date: '', text: 'Write anything you want her to remember…' }] })}><Plus size={14} /> Add another writeup</button>
        <div className="settings-subheading"><Heart size={15} /> THE LETTER & THE SURPRISE</div>
        <label className="wide-label">Your letter<textarea rows={7} value={draft.letter} onChange={(e) => setDraft({ ...draft, letter: e.target.value })} /></label>
        <label className="wide-label">The secret message<textarea rows={4} value={draft.secret} onChange={(e) => setDraft({ ...draft, secret: e.target.value })} /></label>
        {saveError && <div className="error-banner" role="alert">{saveError}</div>}
        <div className="modal-actions">
          {onSignOut && <button type="button" className="text-button" onClick={() => void onSignOut()}>Sign out</button>}
          <button type="button" className="text-button" onClick={onClose}>Maybe later</button>
          <button type="submit" className="button button-dark" disabled={saving}>{saved ? <><Check size={16} /> Saved, with love</> : saving ? 'Saving…' : <><Heart size={14} /> Save our story</>}</button>
        </div>
      </motion.form>
    </motion.div>
  );
}

export default App;
