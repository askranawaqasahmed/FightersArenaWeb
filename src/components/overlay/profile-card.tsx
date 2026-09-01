import type { BoardState } from "@/lib/stream-board-data";
import { Avatar, flagEmoji } from "@/components/overlay/overlay-bits";

export function ProfileCard({ state }: { state: BoardState }) {
  const featured = state.featured;
  if (!state.board.assigned || !featured) return null;
  const flag = flagEmoji(featured.countryIso2);
  const location = [featured.city, featured.countryName].filter(Boolean).join(", ");
  return (
    <div className="overlay-profile overlay-panel">
      <div className="overlay-profile-head">
        <Avatar url={featured.avatarUrl} name={featured.displayName} />
        <div className="overlay-profile-identity">
          <div className="overlay-profile-name">{featured.displayName}</div>
          {featured.handle && (
            <div className="overlay-profile-handle">
              {featured.participantType === "team" ? featured.handle : `@${featured.handle}`}
            </div>
          )}
          {location && (
            <div className="overlay-profile-location">
              {flag ? `${flag} ` : ""}
              {location}
            </div>
          )}
        </div>
      </div>
      {featured.bio && <p className="overlay-profile-bio">{featured.bio}</p>}
      <div className="overlay-profile-stats">
        {featured.rankingPoints !== null && (
          <div className="overlay-profile-stat">
            <span>Ranking points</span>
            <strong>{featured.rankingPoints.toLocaleString()}</strong>
          </div>
        )}
        <div className="overlay-profile-stat">
          <span>Played</span>
          <strong>{featured.record?.played ?? 0}</strong>
        </div>
        <div className="overlay-profile-stat">
          <span>Won</span>
          <strong>{featured.record?.wins ?? 0}</strong>
        </div>
        <div className="overlay-profile-stat">
          <span>Lost</span>
          <strong>{featured.record?.losses ?? 0}</strong>
        </div>
      </div>
      {featured.games.length > 0 && (
        <div className="overlay-profile-games">
          {featured.games.map((entry) => (
            <div key={entry.game} className="overlay-profile-game">
              <strong>{entry.game}</strong>
              <span>
                {entry.inGameName}
                {entry.platform ? ` · ${entry.platform}` : ""}
                {entry.primaryRole ? ` · ${entry.primaryRole}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
