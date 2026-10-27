import { Camera, LoaderCircle, Orbit, X } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import type { ProfileDraft } from "@/lib/profile/model";

export function ProfileIdentity({
  draft,
  update,
  disabled,
  onBusyChange,
}: {
  draft: ProfileDraft;
  update: (patch: Partial<ProfileDraft>) => void;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const load = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 400 * 1024) {
      setError("Choose a PNG, JPG, or WebP image up to 400 KB.");
      return;
    }
    setReading(true);
    onBusyChange(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === "string" ? resolve(reader.result) : reject(new Error());
        reader.onerror = () => reject(new Error());
        reader.readAsDataURL(file);
      });
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => (image.naturalWidth ? resolve() : reject(new Error()));
        image.onerror = () => reject(new Error());
        image.src = data;
      });
      update({ avatarDataUrl: data });
    } catch {
      setError("This image could not be opened. Your previous photo is unchanged.");
    } finally {
      setReading(false);
      onBusyChange(false);
    }
  };
  return (
    <section className="profile-identity" aria-label="Your profile identity">
      <div className="profile-avatar-orbit">
        <span className="profile-avatar-star" aria-hidden>
          ✦
        </span>
        <img
          src={draft.avatarDataUrl || "/avatar-developer.svg"}
          alt={
            draft.avatarDataUrl
              ? "Your chosen profile photo"
              : "Illustrated developer with a laptop profile avatar"
          }
          className="profile-avatar"
          width={100}
          height={100}
        />
        <button
          type="button"
          disabled={disabled || reading}
          className="profile-avatar-edit"
          aria-label="Change profile photo"
          onClick={() => input.current?.click()}
        >
          {reading ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : (
            <Camera className="size-4" aria-hidden />
          )}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label="Choose profile photo"
          className="sr-only"
          disabled={disabled || reading}
          onChange={(event) => void load(event)}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="profile-identity-eyebrow">
          <Orbit className="size-3.5" aria-hidden />
          Your corner of the universe
        </p>
        <h2>{draft.displayName?.trim() || "Hello, explorer."}</h2>
        <p className="profile-identity-caption">
          {draft.fieldOfStudy?.trim() || "A curious mind. A next step waiting."}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
            disabled={disabled || reading}
            onClick={() => input.current?.click()}
          >
            {reading ? "Opening image…" : draft.avatarDataUrl ? "Change photo" : "Add your photo"}
          </button>
          {draft.avatarDataUrl && (
            <button
              type="button"
              disabled={disabled || reading}
              className="flex items-center gap-1 text-[11px] text-muted-foreground"
              onClick={() => update({ avatarDataUrl: "" })}
            >
              <X className="size-3" aria-hidden />
              Remove photo
            </button>
          )}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Optional · PNG, JPG, WebP · up to 400 KB · saved with your profile
        </p>
        {error && (
          <p role="alert" className="profile-error">
            {error}
          </p>
        )}
      </div>
      <div className="profile-identity-stamp" aria-hidden>
        YOUR
        <br />
        <strong>NEXT</strong>
        <br />
        CHAPTER ↗
      </div>
    </section>
  );
}
