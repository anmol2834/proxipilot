"use client";

import { useState } from "react";
import Link from "next/link";
import { IconArrowUpRight, IconSearch } from "@tabler/icons-react";
import styles from "./help.module.css";

export interface HelpSearchItem {
  title: string;
  description: string;
  href: string;
}

export function HelpSearch({ items }: { items: HelpSearchItem[] }) {
  const [query, setQuery] = useState("");
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = terms.length
    ? items.filter(({ title, description }) => {
        const text = `${title} ${description}`.toLowerCase();
        return terms.every((term) => text.includes(term));
      })
    : [];

  return (
    <div className={styles.search} role="search" aria-label="Help Center guides">
      <label className={styles.searchField}>
        <IconSearch size={20} aria-hidden="true" />
        <span className={styles.srOnly}>Search guides</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search guides, e.g. Gmail or drafts"
          aria-controls="help-search-results"
        />
      </label>
      <div id="help-search-results" hidden={!terms.length} className={styles.results}>
        <p role="status">
          {results.length
            ? `${results.length} matching guides`
            : "No matching guides. Try Gmail, drafts, or billing."}
        </p>
        {results.length > 0 && (
          <ul>
            {results.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                  <IconArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
