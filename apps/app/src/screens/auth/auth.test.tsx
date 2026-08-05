import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_PROFILE, pinLanguage, renderAppAt, signedInState } from '../../test-harness.js';

beforeEach(() => {
  localStorage.clear();
  pinLanguage('de');
});

describe('Routenwache', () => {
  it('schickt einen Abgemeldeten von /kalender auf /anmelden', async () => {
    renderAppAt('/kalender', { auth: { session: { status: 'signed-out' } } });
    expect(await screen.findByRole('heading', { name: 'Anmelden' })).toBeInTheDocument();
  });

  it('laesst einen Angemeldeten durch', async () => {
    renderAppAt('/kalender');
    // Der Kalender-Screen, nicht das Anmeldeformular.
    expect(await screen.findByRole('heading', { level: 1 })).not.toHaveTextContent('Anmelden');
  });

  it('zeigt waehrend der Sitzungspruefung keinen Anmeldebildschirm', () => {
    /*
     * Sonst blitzt bei jedem Reload das Anmeldeformular auf, bevor die Sitzung
     * gelesen ist — und die Route ist verloren.
     */
    renderAppAt('/kalender', { auth: { loading: true, session: { status: 'signed-out' } } });
    expect(screen.queryByRole('heading', { name: 'Anmelden' })).not.toBeInTheDocument();
  });

  it('haelt einen offenen Passwort-Ruecksprung auf der Passwortseite fest', async () => {
    /*
     * Der Recovery-Link liefert eine gueltige Sitzung. Wuerde die Wache ihn
     * durchlassen, waere ein weitergeleiteter Mail-Link ein Zugang zur ganzen
     * App.
     */
    renderAppAt('/kalender', { auth: { pendingRecovery: true } });
    expect(
      await screen.findByRole('heading', { name: 'Neues Passwort setzen' }),
    ).toBeInTheDocument();
  });

  it('fuehrt einen Angemeldeten von /anmelden weg', async () => {
    renderAppAt('/anmelden');
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Anmelden' })).not.toBeInTheDocument(),
    );
  });
});

describe('SignInScreen', () => {
  it('meldet an und geht auf das gemerkte Ziel', async () => {
    const signIn = vi.fn().mockResolvedValue({ ok: true });
    renderAppAt('/anmelden', { auth: { session: { status: 'signed-out' }, signIn } });

    await userEvent.type(screen.getByLabelText('E-Mail'), 'lena@example.com');
    await userEvent.type(screen.getByLabelText('Passwort'), 'geheim123');
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(signIn).toHaveBeenCalledWith('lena@example.com', 'geheim123');
  });

  it('fuehrt ohne Partner auf den Verbinden-Screen', async () => {
    /*
     * Fuer ein Paar ist das Verbinden der eigentliche Anfang — Ralia 1.x macht
     * es genauso (navigateAfterAuth: ohne partner_id → connectionScreen).
     */
    const signIn = vi.fn().mockResolvedValue({ ok: true, needsPartner: true });
    const app = renderAppAt('/anmelden', { auth: { session: { status: 'signed-out' }, signIn } });

    await userEvent.type(screen.getByLabelText('E-Mail'), 'lena@example.com');
    await userEvent.type(screen.getByLabelText('Passwort'), 'geheim123');
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    await waitFor(() => expect(app.path()).toBe('/partner-verbinden'));
  });

  it('fuehrt mit Partner direkt in den Kalender', async () => {
    const signIn = vi.fn().mockResolvedValue({ ok: true, needsPartner: false });
    const app = renderAppAt('/anmelden', { auth: { session: { status: 'signed-out' }, signIn } });

    await userEvent.type(screen.getByLabelText('E-Mail'), 'lena@example.com');
    await userEvent.type(screen.getByLabelText('Passwort'), 'geheim123');
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    await waitFor(() => expect(app.path()).toBe('/kalender'));
  });

  it('achtet auf ein gemerktes Ziel, auch ohne Partner', async () => {
    /*
     * Wer einen Link auf die Geld-Ansicht geoeffnet hat, will dorthin. Der
     * Verbinden-Screen ist wichtig, aber nicht wichtiger als eine ausdrueckliche
     * Absicht — er ist ueber die Einstellungen weiter erreichbar.
     */
    const signIn = vi.fn().mockResolvedValue({ ok: true, needsPartner: true });
    const app = renderAppAt('/geld', { auth: { session: { status: 'signed-out' }, signIn } });

    await waitFor(() => expect(app.path()).toBe('/anmelden'));
    await userEvent.type(screen.getByLabelText('E-Mail'), 'lena@example.com');
    await userEvent.type(screen.getByLabelText('Passwort'), 'geheim123');
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    await waitFor(() => expect(app.path()).toBe('/geld'));
  });

  it('verlangt beide Felder, bevor es etwas schickt', async () => {
    const signIn = vi.fn();
    renderAppAt('/anmelden', { auth: { session: { status: 'signed-out' }, signIn } });

    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(signIn).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('Bitte alle Felder ausfüllen.');
  });

  it('zeigt einen Anmeldefehler auf Deutsch', async () => {
    /*
     * Der Punkt der ganzen Fehlerzuordnung: Ralia 1.x zeigt hier „Invalid login
     * credentials" — auch in der deutschen Oberflaeche.
     */
    const signIn = vi.fn().mockResolvedValue({ ok: false, messageKey: 'authInvalidCredentials' });
    renderAppAt('/anmelden', { auth: { session: { status: 'signed-out' }, signIn } });

    await userEvent.type(screen.getByLabelText('E-Mail'), 'lena@example.com');
    await userEvent.type(screen.getByLabelText('Passwort'), 'falsch');
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'E-Mail oder Passwort stimmt nicht.',
    );
  });

  it('traegt die Felder fuer Passwortmanager aus', async () => {
    renderAppAt('/anmelden', { auth: { session: { status: 'signed-out' } } });

    const email = await screen.findByLabelText('E-Mail');
    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Passwort')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('wechselt auf Registrieren und verlangt dort auch den Namen', async () => {
    const signUp = vi.fn();
    renderAppAt('/anmelden', { auth: { session: { status: 'signed-out' }, signUp } });

    await userEvent.click(screen.getByRole('radio', { name: 'Registrieren' }));

    // Das Namensfeld erscheint erst hier.
    expect(await screen.findByLabelText('Name')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('E-Mail'), 'neu@example.com');
    await userEvent.type(screen.getByLabelText('Passwort'), 'geheim123');
    await userEvent.click(screen.getByRole('button', { name: 'Registrieren' }));

    expect(signUp).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('Bitte alle Felder ausfüllen.');
  });

  it('weist ein zu kurzes Passwort ab, ohne zu fragen', async () => {
    const signUp = vi.fn();
    renderAppAt('/anmelden', { auth: { session: { status: 'signed-out' }, signUp } });

    await userEvent.click(screen.getByRole('radio', { name: 'Registrieren' }));
    await userEvent.type(await screen.findByLabelText('Name'), 'Lena');
    await userEvent.type(screen.getByLabelText('E-Mail'), 'neu@example.com');
    await userEvent.type(screen.getByLabelText('Passwort'), 'kurz');
    await userEvent.click(screen.getByRole('button', { name: 'Registrieren' }));

    expect(signUp).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('mindestens 6 Zeichen');
  });

  it('bietet beim Registrieren new-password an, nicht current-password', async () => {
    // Sonst setzt der Passwortmanager das alte Passwort ein statt eines neuen.
    renderAppAt('/anmelden', { auth: { session: { status: 'signed-out' } } });
    await userEvent.click(screen.getByRole('radio', { name: 'Registrieren' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Passwort')).toHaveAttribute('autocomplete', 'new-password'),
    );
  });

  it('zeigt einen Fehler aus der Ruecksprung-URL ohne Zutun', async () => {
    renderAppAt('/anmelden', {
      auth: { session: { status: 'signed-out' }, callbackErrorKey: 'authLinkExpired' },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Dieser Link ist abgelaufen.');
  });
});

describe('ForgotPasswordScreen', () => {
  it('fordert einen Link an und sagt, dass er ueberall funktioniert', async () => {
    /*
     * Der Satz ist die Zusage, fuer die der Mail-Client mit Implicit-Flow
     * existiert. Faellt er weg, ist die Entscheidung nicht mehr sichtbar.
     */
    const requestPasswordReset = vi.fn().mockResolvedValue({ ok: true });
    renderAppAt('/passwort-vergessen', {
      auth: { session: { status: 'signed-out' }, requestPasswordReset },
    });

    await userEvent.type(await screen.findByLabelText('E-Mail'), 'lena@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Link senden' }));

    expect(requestPasswordReset).toHaveBeenCalledWith('lena@example.com');
    expect(await screen.findByRole('status')).toHaveTextContent('Link verschickt');
    expect(screen.getByText(/anderen Gerät/)).toBeInTheDocument();
  });

  it('verlangt eine Adresse', async () => {
    const requestPasswordReset = vi.fn();
    renderAppAt('/passwort-vergessen', {
      auth: { session: { status: 'signed-out' }, requestPasswordReset },
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Link senden' }));

    expect(requestPasswordReset).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('NewPasswordScreen', () => {
  it('speichert das neue Passwort', async () => {
    const updatePassword = vi.fn().mockResolvedValue({ ok: true });
    renderAppAt('/passwort-neu', { auth: { pendingRecovery: true, updatePassword } });

    await userEvent.type(await screen.findByLabelText('Neues Passwort'), 'nochgeheimer1');
    await userEvent.type(screen.getByLabelText('Passwort wiederholen'), 'nochgeheimer1');
    await userEvent.click(screen.getByRole('button', { name: 'Passwort speichern' }));

    expect(updatePassword).toHaveBeenCalledWith('nochgeheimer1');
  });

  it('meldet zwei verschiedene Eingaben, ohne zu speichern', async () => {
    const updatePassword = vi.fn();
    renderAppAt('/passwort-neu', { auth: { pendingRecovery: true, updatePassword } });

    await userEvent.type(await screen.findByLabelText('Neues Passwort'), 'geheim123');
    await userEvent.type(screen.getByLabelText('Passwort wiederholen'), 'geheim124');
    await userEvent.click(screen.getByRole('button', { name: 'Passwort speichern' }));

    expect(updatePassword).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('stimmen nicht überein');
  });

  it('bietet ohne Sitzung einen neuen Link statt eines Formulars', async () => {
    /*
     * Der Fall „Link abgelaufen" oder „ein zweites Mal geoeffnet". Ein
     * Passwortfeld ohne Sitzung waere eine Sackgasse.
     */
    renderAppAt('/passwort-neu', {
      auth: { session: { status: 'signed-out' }, callbackErrorKey: 'authLinkExpired' },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Dieser Link ist abgelaufen.');
    expect(screen.queryByLabelText('Neues Passwort')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Link senden' })).toBeInTheDocument();
  });
});

describe('ConnectPartnerScreen', () => {
  it('zeigt den eigenen Einladungscode', async () => {
    renderAppAt('/partner-verbinden');
    expect(await screen.findByText('R7K2QM')).toBeInTheDocument();
  });

  it('verbindet mit dem eingegebenen Code', async () => {
    const connectPartner = vi.fn().mockResolvedValue({
      ok: true,
      partner: { ...TEST_PROFILE, id: 'p', name: 'Jonas' },
    });
    renderAppAt('/partner-verbinden', { auth: { connectPartner } });

    await userEvent.type(await screen.findByLabelText('Code deines Partners'), 'jx91tb');
    await userEvent.click(screen.getByRole('button', { name: 'Verbinden' }));

    // Grossgeschrieben schon beim Tippen — der Code auf dem Zettel ist gross.
    expect(connectPartner).toHaveBeenCalledWith('JX91TB');
  });

  it('zeigt die Meldung zu einem falschen Code', async () => {
    const connectPartner = vi
      .fn()
      .mockResolvedValue({ ok: false, messageKey: 'invalidInviteCode' });
    renderAppAt('/partner-verbinden', { auth: { connectPartner } });

    await userEvent.type(await screen.findByLabelText('Code deines Partners'), 'XXXXXX');
    await userEvent.click(screen.getByRole('button', { name: 'Verbinden' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ungültiger Einladungscode');
  });

  it('laesst sich ueberspringen', async () => {
    renderAppAt('/partner-verbinden');
    await userEvent.click(await screen.findByRole('button', { name: 'Später' }));

    // Im Kalender, nicht mehr im Verbinden-Screen.
    await waitFor(() =>
      expect(screen.queryByLabelText('Code deines Partners')).not.toBeInTheDocument(),
    );
  });

  it('nennt einen schon verbundenen Partner beim Namen des Problems', async () => {
    const connectPartner = vi.fn().mockResolvedValue({ ok: false, messageKey: 'partnerTaken' });
    renderAppAt('/partner-verbinden', {
      auth: { connectPartner, session: signedInState(TEST_PROFILE) },
    });

    await userEvent.type(await screen.findByLabelText('Code deines Partners'), 'JX91TB');
    await userEvent.click(screen.getByRole('button', { name: 'Verbinden' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('bereits verbundenen');
  });
});
