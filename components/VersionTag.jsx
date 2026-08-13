import { APP_VERSION } from "../utils/version.js";

export default function VersionTag() {
  return <div className="version-tag">AFTERPAYDAY v{APP_VERSION}</div>;
}
