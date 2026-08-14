// Glass phone frame with a home-screen icon grid; the real app icon drops
// into an empty slot via a CSS keyframe (see .phone-graphic in glass.css).
export default function PhoneHomeGraphic() {
  const dimSlots = 11; // 4x3 grid minus the one slot the app icon animates into
  return (
    <div className="phone-graphic" aria-hidden="true">
      <div className="phone-frame">
        <div className="phone-notch" />
        <div className="phone-grid">
          {Array.from({ length: dimSlots }, (_, i) => (
            <div key={i} className="phone-slot dim" />
          ))}
          <div className="phone-slot target">
            <img
              className="phone-slot-icon"
              src={`${import.meta.env.BASE_URL}app-icon.png`}
              alt=""
            />
          </div>
        </div>
        <div className="phone-home-bar" />
      </div>
    </div>
  );
}
