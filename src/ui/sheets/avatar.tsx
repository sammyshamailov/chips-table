/** Your picture: a photo (camera or gallery) or a prepared character, or none (the first letter of your name). */
import { AV_SET } from '../avatars';
import { Avatar, AvatarArt } from '../components/avatar';
import { SheetHead } from '../components/sheet-head';
import type { AvatarOwner, Session } from '../session';

export interface AvatarSheetProps {
  me: AvatarOwner;
  /** The character chosen now, if any. */
  chosen: string | null;
  hasAvatar: boolean;
}

export function avatarSheetProps(s: Session): AvatarSheetProps {
  const a = s.state.avatar;
  return { me: s.myAvatar(), chosen: a && a.k === 'set' ? a.v : null, hasAvatar: !!a };
}

export function AvatarSheet({ me, chosen, hasAvatar }: AvatarSheetProps) {
  return (
    <>
      <SheetHead title="התמונה שלך" />
      <div class="avp">
        <Avatar who={me} class="av big" />
        <span class="muted">כולם בשולחן רואים אותה ליד השם שלך.</span>
      </div>
      <div class="grid2">
        <button class="btn" data-a="avcam">
          צילום עכשיו
        </button>
        <button class="btn" data-a="avfile">
          תמונה מהגלריה
        </button>
      </div>
      <span class="label">או בחרו דמות</span>
      <div class="avgrid">
        {Object.keys(AV_SET).map(id => (
          <button
            key={id}
            class="avopt"
            data-a="avset"
            data-v={id}
            aria-pressed={chosen === id}
            aria-label={`דמות ${id}`}
          >
            <AvatarArt id={id} />
          </button>
        ))}
      </div>
      {hasAvatar && (
        <button class="btn ghost" data-a="avclear">
          בלי תמונה (האות הראשונה של השם)
        </button>
      )}
    </>
  );
}
