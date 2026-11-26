import AlignJustify from 'lucide-react-native/icons/align-justify';
import Archive from 'lucide-react-native/icons/archive';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Bookmark from 'lucide-react-native/icons/bookmark';
import Check from 'lucide-react-native/icons/check';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import CirclePlay from 'lucide-react-native/icons/circle-play';
import Clock from 'lucide-react-native/icons/clock';
import Download from 'lucide-react-native/icons/download';
import ExternalLink from 'lucide-react-native/icons/external-link';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import Film from 'lucide-react-native/icons/film';
import Grid2X2 from 'lucide-react-native/icons/grid-2x2';
import Inbox from 'lucide-react-native/icons/inbox';
import Layers from 'lucide-react-native/icons/layers';
import List from 'lucide-react-native/icons/list';
import Pencil from 'lucide-react-native/icons/pencil';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import RotateCcw from 'lucide-react-native/icons/rotate-ccw';
import Search from 'lucide-react-native/icons/search';
import Settings from 'lucide-react-native/icons/settings';
import Slash from 'lucide-react-native/icons/slash';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import SquareCheck from 'lucide-react-native/icons/square-check';
import Upload from 'lucide-react-native/icons/upload';
import User from 'lucide-react-native/icons/user';
import X from 'lucide-react-native/icons/x';
import { useAppearance } from '../appearance.ts';

const icons = {
  'align-justify': AlignJustify, archive: Archive, 'arrow-left': ArrowLeft, bookmark: Bookmark, check: Check,
  'check-circle': CircleCheck, 'check-square': SquareCheck, 'chevron-left': ChevronLeft, 'chevron-right': ChevronRight,
  clock: Clock, download: Download, 'edit-2': Pencil, 'external-link': ExternalLink, eye: Eye, 'eye-off': EyeOff,
  film: Film, grid: Grid2X2, inbox: Inbox, layers: Layers, list: List, 'play-circle': CirclePlay, 'refresh-cw': RefreshCw,
  'rotate-ccw': RotateCcw, search: Search, settings: Settings, slash: Slash, sliders: SlidersHorizontal, upload: Upload, user: User, x: X,
};

export type IconName = keyof typeof icons;

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const { palette } = useAppearance();
  const Glyph = icons[name];
  return <Glyph size={size} color={color ?? palette.textPrimary} strokeWidth={1.8}
    accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden />;
}
