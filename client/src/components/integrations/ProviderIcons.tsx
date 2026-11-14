import React from "react";

export function GmailLogo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6Z"
        fill="#F2F2F2"
      />
      <path
        d="M20 4L12 11.5L4 4H20Z"
        fill="#EA4335"
      />
      <path
        d="M2 6V18C2 19.1 2.9 20 4 20H6V9.25L2 5.5V6Z"
        fill="#4285F4"
      />
      <path
        d="M22 6V18C22 19.1 21.1 20 20 20H18V9.25L22 5.5V6Z"
        fill="#34A853"
      />
      <path
        d="M18 9.25L12 14.5L6 9.25V20H18V9.25Z"
        fill="#FBBC05"
      />
      <path
        d="M18 9.25L12 14.5L6 9.25V7.5L12 12.75L18 7.5V9.25Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function OutlookLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="#F0F4F9" />
      <path
        d="M19.5 7.5L25 10.5V21.5L19.5 24.5V7.5Z"
        fill="#0078D4"
      />
      <path
        d="M19.5 10.5L12.5 13V24.5L19.5 22V10.5Z"
        fill="#28A8EA"
      />
      <path
        d="M7 11.5L12.5 13.5V23L7 20.5V11.5Z"
        fill="#0078D4"
      />
      <circle cx="16" cy="16" r="3.5" fill="#004E8C" opacity="0.3" />
      <path
        d="M16 13.5C17.3807 13.5 18.5 14.6193 18.5 16C18.5 17.3807 17.3807 18.5 16 18.5C14.6193 18.5 13.5 17.3807 13.5 16C13.5 14.6193 14.6193 13.5 16 13.5Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function ImapLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="#EFF6FF" />
      <path
        d="M8 11C8 9.89543 8.89543 9 10 9H22C23.1046 9 24 9.89543 24 11V21C24 22.1046 23.1046 23 22 23H10C8.89543 23 8 22.1046 8 21V11Z"
        stroke="#2563EB"
        strokeWidth="2"
      />
      <path
        d="M8.5 11.5L16 16.5L23.5 11.5"
        stroke="#2563EB"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SalesforceLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="#F0F9FF" />
      <path
        d="M14.5 10.5C15.5 9 17.5 8.5 19.5 9.5C21 10.2 22 11.8 22 13.5C23.2 13.8 24.2 14.8 24.5 16.2C24.7 17.8 23.8 19.3 22.3 19.8C22 19.9 21.5 20 21 20H10C8.3 20 7 18.7 7 17C7 15.5 8.1 14.2 9.6 14.05C9.8 12.3 11 11 12.7 10.6C13.3 10.4 14 10.4 14.5 10.5Z"
        fill="#00A1E0"
      />
    </svg>
  );
}

export function HubSpotLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="#FFF7ED" />
      <path
        d="M21.5 14.5V12C21.5 11.17 20.83 10.5 20 10.5C19.17 10.5 18.5 11.17 18.5 12V14.5C17.7 14.9 17.15 15.65 17.02 16.55L14.1 14.4C14.15 14.1 14.2 13.8 14.2 13.5C14.2 11.84 12.86 10.5 11.2 10.5C9.54 10.5 8.2 11.84 8.2 13.5C8.2 15.16 9.54 16.5 11.2 16.5C11.65 16.5 12.07 16.4 12.45 16.22L15.3 18.35C15.15 18.85 15.15 19.4 15.35 19.9L13.1 21.4C12.7 21.15 12.25 21 11.75 21C10.23 21 9 22.23 9 23.75C9 25.27 10.23 26.5 11.75 26.5C13.27 26.5 14.5 25.27 14.5 23.75C14.5 23.35 14.4 22.95 14.2 22.62L16.45 21.1C17.05 21.7 17.9 22.05 18.85 22.05C20.5 22.05 21.85 20.7 21.85 19.05C21.85 17.85 21.15 16.8 20.15 16.35V14.5H21.5Z"
        fill="#FF7A59"
      />
    </svg>
  );
}

export function SlackLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="#F8FAFC" />
      <path
        d="M10.5 17C9.67 17 9 17.67 9 18.5C9 19.33 9.67 20 10.5 20H12V18.5C12 17.67 11.33 17 10.5 17Z"
        fill="#E01E5A"
      />
      <path
        d="M13 18.5C13 17.67 13.67 17 14.5 17C15.33 17 16 17.67 16 18.5V22.5C16 23.33 15.33 24 14.5 24C13.67 24 13 23.33 13 22.5V18.5Z"
        fill="#E01E5A"
      />
      <path
        d="M14.5 10.5C14.5 9.67 13.83 9 13 9C12.17 9 11.5 9.67 11.5 10.5V12H13C13.83 12 14.5 11.33 14.5 10.5Z"
        fill="#36C5F0"
      />
      <path
        d="M13 13C13.83 13 14.5 13.67 14.5 14.5C14.5 15.33 13.83 16 13 16H9C8.17 16 7.5 15.33 7.5 14.5C7.5 13.67 8.17 13 9 13H13Z"
        fill="#36C5F0"
      />
      <path
        d="M21.5 14.5C22.33 14.5 23 13.83 23 13C23 12.17 22.33 11.5 21.5 11.5H20V13C20 13.83 20.67 14.5 21.5 14.5Z"
        fill="#2EB67D"
      />
      <path
        d="M19 13C19 13.83 18.33 14.5 17.5 14.5C16.67 14.5 16 13.83 16 13V9C16 8.17 16.67 7.5 17.5 7.5C18.33 7.5 19 8.17 19 9V13Z"
        fill="#2EB67D"
      />
      <path
        d="M17.5 21.5C17.5 22.33 18.17 23 19 23C19.83 23 20.5 22.33 20.5 21.5V20H19C18.17 20 17.5 20.67 17.5 21.5Z"
        fill="#ECB22E"
      />
      <path
        d="M19 18.5C18.17 18.5 17.5 17.83 17.5 17C17.5 16.17 18.17 15.5 19 15.5H23C23.83 15.5 24.5 16.17 24.5 17C24.5 17.83 23.83 18.5 23 18.5H19Z"
        fill="#ECB22E"
      />
    </svg>
  );
}

export function GoogleDriveLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="#F0FDF4" />
      <path
        d="M11.5 21.5L8.5 16.5L14 7H20L14.5 16.5H11.5Z"
        fill="#0066DA"
      />
      <path
        d="M20 7L24 14L18.5 23.5L14.5 16.5L20 7Z"
        fill="#00AC47"
      />
      <path
        d="M14.5 16.5L18.5 23.5H9.5L6 17.5L11.5 21.5H14.5Z"
        fill="#FFBA00"
      />
      <path
        d="M18.5 23.5H8L11.5 17.5H22L18.5 23.5Z"
        fill="#2684FC"
      />
    </svg>
  );
}
