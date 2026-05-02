export default function Library({ likedSongs, loading, onRemoveSong }) {
  return (
    <section className="panel">
      <h2>Your Library</h2>
      <p>Songs you saved from the app will appear here.</p>
      {loading && <p>Loading library...</p>}
      {!loading && likedSongs.length === 0 ? (
        <p>Add some songs!</p>
      ) : (
        likedSongs.map((music) => (
          <article key={music.id} className="tracks">
            {music.album?.images?.[0]?.url && (
              <img
                className="album-art"
                src={music.album.images[0].url}
                alt={`${music.name} album art`}
                width="120"
                height="120"
              />
            )}
            <h3>{music.name}</h3>
            <p>{music.artists?.map((artist) => artist.name).join(', ')}</p>
            <p>{music.album?.name}</p>
            <button type="button" onClick={() => onRemoveSong(music.id)}>
              Unlike and remove
            </button>
          </article>
        ))
      )}
    </section>
  );
}
