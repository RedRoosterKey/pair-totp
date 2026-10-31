# Security

## What pair-totp is for

Two people who trust each other set up a shared TOTP secret in person. Later, on a call or in a message, the person who started the conversation reads out the current 6-digit code, and the other checks it against their own authenticator app. A scammer with a cloned voice or face can't produce that code.

## What it protects against

- **Voice and video cloning.** A deepfake can copy how someone sounds or looks, but not a code that changes every 30 seconds.
- **Caller ID spoofing.** A spoofed number doesn't come with the code.
- **Relay attacks, if you follow the rule.** A scammer could call each of you at the same time, pretending to be the other, and try to pass one person's code on to the other. The rule "whoever starts the call reads first, and never read your code to someone who called you" stops this, because the scammer has no code to start with.
- **Replay.** An overheard code is only good until the codes change, at most 30 seconds later, or a little longer if someone accepts the previous code near a change.

## What it doesn't protect against

- **Someone who saw the setup.** Anyone who sees or photographs a QR code, or watches a screen share or recording of the setup, can make the same codes. Set up in person, with no one else watching.
- **A stolen, unlocked phone.** Whoever has your authenticator app has your codes. Lock your phone, and use the app's own lock if it has one. If a phone is lost, delete the entry on the other phone and run pair-totp again.
- **A compromised phone or browser.** Malware on either phone, or on the device running the wizard, can read the secret.
- **Your app's backups.** If your authenticator app backs up or syncs its entries, the secret is only as safe as that backup. Ente Auth encrypts its backups end to end. Choose "Use without an account" in Google Authenticator if you don't want it synced to Google.
- **Coercion.** Someone forced to read out their code will.

## How the page protects the secret

- The secret comes from `crypto.getRandomValues` (160 bits). If that isn't available, the wizard stops instead of creating a weak secret.
- It's never stored, never put in the URL, and never sent anywhere. The Content-Security-Policy blocks all network connections, so the browser enforces this.
- Each QR code is removed from the page when you move on, and the secret's bytes are zeroed at the end. JavaScript can't overwrite strings in memory, so close the tab when you're done.
- `app.js` refuses to run inside another page's frame, since GitHub Pages can't send `X-Frame-Options`.
- Subresource Integrity hashes pin `app.js`, `style.css` and `vendor/qrcode.js`. Every GitHub Pages site under one account shares an origin, so the CSP's `'self'` alone would also trust the owner's other Pages sites.
- Names are filtered as you type and only ever inserted into the page as text.
- `vendor/qrcode.js` is qrcode-generator 1.4.4, unmodified. The README shows how to check it against npm.

## What you're trusting

- **The GitHub account that publishes the site.** Whoever controls it controls the code you run. The live files can be compared with the repository using the commands in the README.
- **The owner's other Pages sites.** They share an origin with pair-totp. The integrity hashes stop their scripts loading into this page, but a page on the same origin could still read this one if you opened it from there. Open pair-totp directly from its own address.
- **Your browser and your authenticator app.**

## Reporting a problem

Please report security issues privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**, or go to <https://github.com/RedRoosterKey/pair-totp/security/advisories/new>. Please don't open a public issue for a security problem.
