#!/usr/bin/env python3
"""
IMAP email fetcher for recepcion@centrohogarsanchez.es
Downloads all emails from all folders, saves as JSON.
"""

import imaplib
import email
import email.header
import email.utils
import json
import os
import sys
import ssl
from datetime import datetime
from collections import Counter, defaultdict

# ── Config ──────────────────────────────────────────────────────────
USER = os.environ.get('RECEPTION_EMAIL_USER', 'recepcion@centrohogarsanchez.es')
PASS = os.environ.get('RECEPTION_EMAIL_PASS', '')
OUTPUT_DIR = '/home/claudeuser/eliasortega/data/emails'

SERVERS_TO_TRY = [
    ('mail.serviciodecorreo.es', 993, True),
    ('imap.serviciodecorreo.es', 993, True),
    ('serviciodecorreo.es', 993, True),
    ('mail.serviciodecorreo.es', 143, False),
    ('imap.serviciodecorreo.es', 143, False),
    ('serviciodecorreo.es', 143, False),
]

def connect_imap():
    """Try multiple IMAP servers and return connected client."""
    for host, port, use_ssl in SERVERS_TO_TRY:
        try:
            print(f"  Trying {host}:{port} (SSL={use_ssl})...", end=" ", flush=True)
            if use_ssl:
                ctx = ssl.create_default_context()
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
                conn = imaplib.IMAP4_SSL(host, port, ssl_context=ctx)
            else:
                conn = imaplib.IMAP4(host, port)
                conn.starttls()

            conn.login(USER, PASS)
            print(f"OK! Connected to {host}:{port}")
            return conn
        except Exception as e:
            print(f"FAILED ({e})")

    raise Exception("Could not connect to any IMAP server")


def decode_header_value(raw):
    """Decode RFC2047 encoded header."""
    if raw is None:
        return ""
    parts = email.header.decode_header(raw)
    decoded = []
    for data, charset in parts:
        if isinstance(data, bytes):
            decoded.append(data.decode(charset or 'utf-8', errors='replace'))
        else:
            decoded.append(str(data))
    return ' '.join(decoded)


def extract_email_data(msg, folder_name):
    """Extract structured data from an email message."""
    # From
    from_raw = msg.get('From', '')
    from_name, from_email_addr = email.utils.parseaddr(from_raw)
    from_name = decode_header_value(from_name) if from_name else from_email_addr

    # To
    to_raw = msg.get('To', '')
    to_list = [addr for _, addr in email.utils.getaddresses([to_raw]) if addr]

    # CC
    cc_raw = msg.get('Cc', '')
    cc_list = [addr for _, addr in email.utils.getaddresses([cc_raw]) if addr]

    # Subject
    subject = decode_header_value(msg.get('Subject', ''))

    # Date
    date_raw = msg.get('Date', '')
    try:
        date_tuple = email.utils.parsedate_to_datetime(date_raw)
        date_str = date_tuple.isoformat()
    except Exception:
        date_str = date_raw

    # Message-ID
    message_id = msg.get('Message-ID', '')

    # Body
    body_text = ''
    body_html = ''
    attachments = []

    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            disposition = str(part.get('Content-Disposition', ''))

            if 'attachment' in disposition or part.get_filename():
                fname = decode_header_value(part.get_filename() or 'unnamed')
                size = len(part.get_payload(decode=True) or b'')
                attachments.append({
                    'filename': fname,
                    'content_type': content_type,
                    'size_bytes': size,
                })
            elif content_type == 'text/plain' and not body_text:
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or 'utf-8'
                    body_text = payload.decode(charset, errors='replace')
            elif content_type == 'text/html' and not body_html:
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or 'utf-8'
                    body_html = payload.decode(charset, errors='replace')
    else:
        content_type = msg.get_content_type()
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or 'utf-8'
            text = payload.decode(charset, errors='replace')
            if content_type == 'text/html':
                body_html = text
            else:
                body_text = text

    return {
        'folder': folder_name,
        'message_id': message_id,
        'date': date_str,
        'from_name': from_name,
        'from_email': from_email_addr.lower() if from_email_addr else '',
        'to': to_list,
        'cc': cc_list,
        'subject': subject,
        'body_text': body_text[:3000] if body_text else '',
        'body_html_preview': body_html[:500] if body_html else '',
        'attachments': attachments,
        'has_attachments': len(attachments) > 0,
    }


def safe_filename(name):
    """Convert folder name to safe filename."""
    return name.replace('/', '_').replace('\\', '_').replace(' ', '_').replace('.', '_').replace('"', '')


def fetch_folder(conn, folder_name):
    """Fetch all emails from a single folder."""
    emails = []

    # Try selecting folder
    try:
        status, data = conn.select(f'"{folder_name}"', readonly=True)
        if status != 'OK':
            # Try without quotes
            status, data = conn.select(folder_name, readonly=True)
            if status != 'OK':
                print(f"    Cannot select folder: {folder_name} ({status})")
                return emails
    except Exception as e:
        print(f"    Error selecting {folder_name}: {e}")
        return emails

    msg_count = int(data[0])
    if msg_count == 0:
        print(f"    {folder_name}: 0 emails")
        return emails

    print(f"    {folder_name}: {msg_count} emails, fetching...", end=" ", flush=True)

    # Fetch all message IDs
    status, data = conn.search(None, 'ALL')
    if status != 'OK':
        print(f"search failed")
        return emails

    msg_ids = data[0].split()
    fetched = 0

    for msg_id in msg_ids:
        try:
            status, data = conn.fetch(msg_id, '(RFC822)')
            if status != 'OK':
                continue

            raw_email = data[0][1]
            msg = email.message_from_bytes(raw_email)
            email_data = extract_email_data(msg, folder_name)
            emails.append(email_data)
            fetched += 1

            if fetched % 50 == 0:
                print(f"{fetched}", end=" ", flush=True)
        except Exception as e:
            print(f"\n    Error on msg {msg_id}: {e}", end=" ")
            continue

    print(f"done ({fetched})")
    return emails


def main():
    if not PASS:
        print("ERROR: RECEPTION_EMAIL_PASS not set")
        sys.exit(1)

    print(f"Connecting as {USER}...")
    conn = connect_imap()

    # ── List all folders ──
    print("\n=== LISTING FOLDERS ===")
    status, folder_data = conn.list()
    folders = []
    for item in folder_data:
        decoded = item.decode('utf-8', errors='replace') if isinstance(item, bytes) else str(item)
        # Parse IMAP LIST response: (flags) delimiter name
        parts = decoded.split('"')
        if len(parts) >= 3:
            folder_name = parts[-2] if parts[-1].strip() == '' else parts[-1].strip().strip('"')
        else:
            # Try another parse approach
            folder_name = decoded.split(' ')[-1].strip().strip('"')

        # Clean up
        folder_name = folder_name.strip()
        if folder_name:
            folders.append(folder_name)

    # Deduplicate and sort
    folders = sorted(set(folders))

    print(f"\nFound {len(folders)} folders:")
    for f in folders:
        print(f"  {f}")

    # Save folder list
    with open(os.path.join(OUTPUT_DIR, 'folder_list.json'), 'w') as fh:
        json.dump(folders, fh, indent=2, ensure_ascii=False)

    # ── Fetch all emails ──
    print("\n=== FETCHING EMAILS ===")
    all_emails = []
    folder_counts = {}

    for folder_name in folders:
        emails = fetch_folder(conn, folder_name)
        all_emails.extend(emails)
        folder_counts[folder_name] = len(emails)

        # Save per-folder JSON
        if emails:
            fname = safe_filename(folder_name)
            filepath = os.path.join(OUTPUT_DIR, f'{fname}.json')
            with open(filepath, 'w') as fh:
                json.dump(emails, fh, indent=1, ensure_ascii=False)

    conn.logout()

    # Save all emails
    with open(os.path.join(OUTPUT_DIR, 'all_emails.json'), 'w') as fh:
        json.dump(all_emails, fh, indent=1, ensure_ascii=False)

    # ── Statistics ──
    print("\n" + "="*60)
    print(f"TOTAL EMAILS DOWNLOADED: {len(all_emails)}")
    print("="*60)

    print("\n--- Emails per folder ---")
    for folder, count in sorted(folder_counts.items(), key=lambda x: -x[1]):
        if count > 0:
            print(f"  {count:5d}  {folder}")

    # Date range
    dates = []
    for e in all_emails:
        try:
            d = datetime.fromisoformat(e['date'].replace('Z',''))
            dates.append(d)
        except:
            pass

    if dates:
        print(f"\n--- Date range ---")
        print(f"  First: {min(dates).strftime('%Y-%m-%d')}")
        print(f"  Last:  {max(dates).strftime('%Y-%m-%d')}")

    # Top senders
    sender_counter = Counter()
    sender_names = {}
    for e in all_emails:
        addr = e['from_email']
        sender_counter[addr] += 1
        sender_names[addr] = e['from_name']

    print(f"\n--- Top 20 senders ---")
    for addr, count in sender_counter.most_common(20):
        name = sender_names.get(addr, '')
        print(f"  {count:5d}  {addr:45s}  {name}")

    # Top domains
    domain_counter = Counter()
    for addr in sender_counter:
        if '@' in addr:
            domain_counter[addr.split('@')[1]] += sender_counter[addr]

    print(f"\n--- Top 20 email domains ---")
    for domain, count in domain_counter.most_common(20):
        print(f"  {count:5d}  {domain}")

    # Save stats
    stats = {
        'total_emails': len(all_emails),
        'folder_counts': folder_counts,
        'date_range': {
            'first': min(dates).isoformat() if dates else None,
            'last': max(dates).isoformat() if dates else None,
        },
        'top_senders': [{'email': a, 'name': sender_names.get(a,''), 'count': c} for a, c in sender_counter.most_common(50)],
        'top_domains': [{'domain': d, 'count': c} for d, c in domain_counter.most_common(30)],
    }
    with open(os.path.join(OUTPUT_DIR, 'stats.json'), 'w') as fh:
        json.dump(stats, fh, indent=2, ensure_ascii=False)

    print(f"\nFiles saved to {OUTPUT_DIR}/")
    print("Done!")


if __name__ == '__main__':
    main()
