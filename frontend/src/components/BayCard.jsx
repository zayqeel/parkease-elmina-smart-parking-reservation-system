import { Accessibility, CarFront, LockKeyhole, Radio, Wrench } from "lucide-react";
import { StatusPill } from "./UI";

export default function BayCard({ space, onSelect, selected }) {
  const available = space.status === "AVAILABLE";
  const smart = space.zone === "SMART";
  return (
    <button
      className={`bay-card ${selected ? "selected" : ""} ${available ? "" : "unavailable"}`}
      onClick={() => onSelect?.(space)}
      aria-pressed={selected}
    >
      <span className="bay-card-top">
        <span className="bay-code">{space.code}</span>
        <StatusPill value={space.status} />
      </span>
      <span className="parking-mark">
        <span className="parking-lines" />
        {space.status === "MAINTENANCE" ? <Wrench size={30} /> : <CarFront size={34} />}
      </span>
      <span className="bay-meta">
        <span><Radio size={15} /> {space.sensor_occupied ? "Occupied" : "Sensor clear"}</span>
        {smart && <span><LockKeyhole size={15} /> Bollard {space.bollard_status.toLowerCase()}</span>}
      </span>
    </button>
  );
}

