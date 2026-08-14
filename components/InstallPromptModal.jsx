import { useEffect, useRef, useState } from "react";
import { Share, PlusSquare } from "lucide-react";
import PhoneHomeGraphic from "./PhoneHomeGraphic";
import useFocusTrap from "../hooks/useFocusTrap.js";
import useInstallPrompt from "../hooks/useInstallPrompt.js";
import { SHEET_ANIM_MS } from "../utils/ui.js";

export default function InstallPromptModal({ onClose }) {
  const [isOpen, setIsOpen] = useState(false);
  const modalRef = useRef(null);
  const { isIOS, install, setPromptEnabled } = useInstallPrompt();

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsOpen(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const close = (callback) => {
    setIsOpen(false);
    setTimeout(callback, SHEET_ANIM_MS);
  };

  const dismiss = () => {
    setPromptEnabled(false);
    close(onClose);
  };

  useFocusTrap(modalRef, { active: isOpen, onEscape: dismiss });

  const handleInstall = async () => {
    await install();
    close(onClose);
  };

  return (
    <>
      <div className={`scrim${isOpen ? " on" : ""}`} onClick={dismiss} />
      <div
        ref={modalRef}
        className={`install-modal${isOpen ? " on" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Add to Home Screen"
        onClick={(e) => e.stopPropagation()}
      >
        <PhoneHomeGraphic />

        <div className="install-modal-text">
          <h3>Add AfterPayday to your Home Screen</h3>
          <p>Open it like a real app — full screen, works offline.</p>
        </div>

        {isIOS ? (
          <>
            <ol className="install-steps">
              <li>
                <Share size={16} strokeWidth={1.75} />
                <span>Tap the <b>Share</b> button in your browser bar</span>
              </li>
              <li>
                <PlusSquare size={16} strokeWidth={1.75} />
                <span>Choose <b>Add to Home Screen</b></span>
              </li>
            </ol>
            <div className="install-modal-actions">
              <button className="btn-primary" onClick={dismiss}>Got it</button>
            </div>
          </>
        ) : (
          <div className="install-modal-actions">
            <button className="btn-primary" onClick={handleInstall}>
              Add to Home Screen
            </button>
            <button type="button" className="install-later-btn" onClick={dismiss}>
              Maybe later
            </button>
          </div>
        )}
      </div>
    </>
  );
}
