"use client";

import { useState, type FormEvent } from "react";
import { ExpandableCtaButton } from "@/components/ui/ExpandableCtaButton";
import { HELP_EMAIL } from "@/data/help-content";
import styles from "./help.module.css";

export function HelpCenterClient() {
  const [draftOpened, setDraftOpened] = useState(false);

  function composeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const subject = encodeURIComponent(`ProxiPilot support: ${form.get("topic")}`);
    const body = encodeURIComponent(
      [
        `Name: ${form.get("name")}`,
        `Reply email: ${form.get("email")}`,
        "",
        String(form.get("message")).trim(),
      ].join("\r\n")
    );

    window.location.href = `mailto:${HELP_EMAIL}?subject=${subject}&body=${body}`;
    setDraftOpened(true);
  }

  return (
    <form
      id="contact-support"
      className={styles.form}
      action={`mailto:${HELP_EMAIL}`}
      method="post"
      encType="text/plain"
      onSubmit={composeEmail}
      aria-labelledby="support-heading"
    >
      <h2 id="support-heading">Contact ProxiPilot support</h2>
      <div className={styles.formRow}>
        <label>
          Your name
          <input
            name="name"
            autoComplete="name"
            maxLength={120}
            placeholder="Priya Sharma"
            required
          />
        </label>
        <label>
          Email address
          <input
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            placeholder="priya.sharma@example.com"
            required
          />
        </label>
      </div>
      <label>
        What do you need help with?
        <select name="topic" defaultValue="Mailbox setup or sync">
          <option>Mailbox setup or sync</option>
          <option>AI drafts and approvals</option>
          <option>Business knowledge</option>
          <option>Plans and billing</option>
          <option>Something else</option>
        </select>
      </label>
      <label>
        Your message
        <textarea
          name="message"
          rows={4}
          maxLength={1200}
          placeholder="Tell us what you were trying to do and what happened."
          required
        />
      </label>
      <ExpandableCtaButton type="submit" text="Open email draft" fullWidth />
      <p className={styles.formNote} role="status">
        {draftOpened ? (
          <>
            Send the draft from your email app. If it didn’t open, email{" "}
            <a href={`mailto:${HELP_EMAIL}`}>{HELP_EMAIL}</a> directly.
          </>
        ) : (
          "Opens your email app with the details filled in. Send the message from there."
        )}
      </p>
    </form>
  );
}
