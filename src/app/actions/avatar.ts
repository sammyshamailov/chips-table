/**
 * Your avatar: a photo (camera or gallery) or one of the prepared characters (src/ui/avatars.ts). Saved on the phone
 * (`chips.avatar`) and on your player document, so the others see it at once; that write sets no `lastAction`, so
 * nothing animates.
 */
import { validAv } from '../../ui/avatars';
import { avatarFromPhoto } from '../../ui/photo';
import type { Actions, AppContext } from '../context';
import { me, playerPath } from '../state';

const PHOTO_INPUTS = ['avcam', 'avfile'];

function setAvatar(c: AppContext, a: unknown): void {
  const { S } = c;
  S.avatar = validAv(a) ? a : null;
  if (S.avatar) c.storage.set('chips.avatar', JSON.stringify(S.avatar));
  else c.storage.del('chips.avatar');
  if (S.code && me(S)) c.write(playerPath(S), 'update', { avatar: S.avatar });
  c.snd.chips(2);
  c.render();
}

async function loadPhoto(c: AppContext, file: File | undefined): Promise<void> {
  if (!file) return;
  if (!/^image\//.test(file.type || 'image/')) {
    c.toast('זה לא קובץ תמונה');
    return;
  }
  try {
    setAvatar(c, { k: 'img', v: await avatarFromPhoto(file) });
    c.toast('התמונה עודכנה');
  } catch {
    c.toast('לא הצלחנו לקרוא את התמונה. נסו תמונה אחרת.');
  }
}

/**
 * Listens to the camera and gallery inputs. They live outside the screens (index.html): a table update while the
 * picker is open would otherwise replace them, and their `change` would never arrive.
 */
export function listenPhotoInputs(c: AppContext): void {
  PHOTO_INPUTS.forEach(id => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el)
      el.addEventListener('change', () => {
        const f = el.files && el.files[0];
        el.value = '';
        loadPhoto(c, f || undefined);
      });
  });
}

export function avatarActions(c: AppContext): Actions {
  const pick = (id: string) => (document.getElementById(id) as HTMLInputElement).click();
  return {
    avcam: () => pick('avcam'),
    avfile: () => pick('avfile'),
    avset: v => setAvatar(c, { k: 'set', v }),
    avclear: () => setAvatar(c, null),
  };
}
