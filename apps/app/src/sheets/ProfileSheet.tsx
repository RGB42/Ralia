import { BottomSheet, Button, FieldLabel, Input, PERSON_SLOTS, personTokens } from '@ralia/ui';
import type { PersonSlot } from '@ralia/ui';
import { useId, useState } from 'react';
import { useT } from '../i18n/useT.js';
import type { MockPerson } from '../mock/fixtures.js';
import styles from './sheets.module.css';

export interface ProfileSheetProps {
  open: boolean;
  profile: MockPerson;
  onClose(): void;
  onSave(next: MockPerson): void;
}

/** Vorlage Z. 950–981. */
export function ProfileSheet({
  open,
  profile,
  onClose,
  onSave,
}: ProfileSheetProps): React.JSX.Element {
  const { t } = useT();
  const baseId = useId();
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [birthday, setBirthday] = useState(profile.birthday);
  const [slot, setSlot] = useState<PersonSlot>(profile.slot);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      closeLabel={t('sheetClose')}
      title={t('sheetEditProfile')}
    >
      <div className={styles.fields}>
        <div>
          <FieldLabel htmlFor={`${baseId}-name`}>{t('sheetName')}</FieldLabel>
          <Input id={`${baseId}-name`} value={name} onChange={setName} />
        </div>
        <div>
          <FieldLabel htmlFor={`${baseId}-mail`}>{t('sheetEmail')}</FieldLabel>
          <Input id={`${baseId}-mail`} type="email" value={email} onChange={setEmail} />
        </div>
        <div>
          <FieldLabel htmlFor={`${baseId}-bday`}>{t('settingsBirthday')}</FieldLabel>
          <Input id={`${baseId}-bday`} type="date" value={birthday} onChange={setBirthday} />
        </div>
        <div>
          <FieldLabel>{t('sheetColor')}</FieldLabel>
          <div className={styles.colors}>
            {PERSON_SLOTS.map((entry) => (
              <button
                key={entry}
                type="button"
                aria-pressed={slot === entry}
                aria-label={`${t('sheetColor')}: ${entry}`}
                className={`${styles.color} ${slot === entry ? styles.colorActive : ''}`}
                style={{ background: personTokens(entry).bar }}
                onClick={() => setSlot(entry)}
              >
                <span aria-hidden="true">{slot === entry ? '✓' : ''}</span>
              </button>
            ))}
          </div>
        </div>
        <div className={styles.actions}>
          <Button
            fullWidth
            onClick={() => {
              if (name.trim() === '') return;
              onSave({ ...profile, name: name.trim(), email: email.trim(), birthday, slot });
            }}
          >
            {t('sheetSave')}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
