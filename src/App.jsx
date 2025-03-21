import { useState } from "react";
import {
	Container,
	TextField,
	Button,
	Card,
	CardContent,
	Typography,
	LinearProgress,
	List,
	ListItem,
	ListItemText,
	Box,
	FormControl,
} from "@mui/material";
import axios from "axios";

function App() {
	const [username, setUsername] = useState("");
	const [loading, setLoading] = useState(false);
	const [stats, setStats] = useState(null);
	const [error, setError] = useState(null);
	const [progress, setProgress] = useState(0);
	const [pages, setPages] = useState(0);
	const [totalPages, setTotalPages] = useState(0);
	const [startTime, setStartTime] = useState(null);
	const [estimatedTimeRemaining, setEstimatedTimeRemaining] =
		useState(null);

	const LASTFM_API_KEY = "3c2d925057341118cffa8934713275b4"; // Move this to an environment variable
	const LASTFM_BASE_URL = "https://ws.audioscrobbler.com/2.0/";

	const fetchStats = async () => {
		try {
			setLoading(true);
			setError(null);
			setStats(null);
			setStartTime(Date.now());

			// Get recent tracks page by page
			const tracks = [];
			let page = 1;
			let totalPages = 1;

			do {
				const response = await axios.get(LASTFM_BASE_URL, {
					params: {
						method: "user.getrecenttracks",
						user: username,
						api_key: LASTFM_API_KEY,
						format: "json",
						limit: 200,
						page: page,
						from: 1735668000,
					},
				});

				const data = response.data.recenttracks;
				totalPages = parseInt(data["@attr"].totalPages);
				tracks.push(...data.track);

				// Update progress and estimate time remaining
				const percentage = Math.round((page / totalPages) * 100);
				setProgress(percentage);
				setPages(page);
				setTotalPages(totalPages);

				//  estimated time remaining
				const elapsedTime = (Date.now() - startTime) / 10000; // in seconds
				console.log("current page", page);
				console.log("elapsed time", elapsedTime);
				const timePerPage = elapsedTime / page;
				const pagesRemaining = totalPages - page;
				const estimatedSeconds = Math.round(
					timePerPage * pagesRemaining
				);
				setEstimatedTimeRemaining(Math.max(1, estimatedSeconds)); // Ensure minimum 1 second

				page++;
			} while (page <= totalPages);

			const stats = analyzeListeningHistory(tracks);
			setStats(stats);
		} catch (err) {
			setError(
				err.response?.data?.message || "Failed to fetch Last.fm data"
			);
		} finally {
			setLoading(false);
			setProgress(0);
			setEstimatedTimeRemaining(null);
		}
	};

	const analyzeListeningHistory = (tracks) => {
		// Filter out currently playing track if exists
		const completedTracks = tracks.filter(
			(track) => !track["@attr"]?.nowplaying
		);

		// Get all dates sorted
		const trackDates = completedTracks.map(
			(track) =>
				new Date(track.date.uts * 1000).toISOString().split("T")[0]
		);
		const uniqueDates = [...new Set(trackDates)].sort();

		// Calculate basic stats
		const totalTracks = completedTracks.length;
		const firstDate = uniqueDates[0];
		const lastDate = uniqueDates[uniqueDates.length - 1];
		const totalDays =
			Math.ceil(
				(new Date(lastDate) - new Date(firstDate)) /
					(1000 * 60 * 60 * 24)
			) + 1;

		// Calculate tracks per day
		const tracksPerDay = trackDates.reduce((acc, date) => {
			acc[date] = (acc[date] || 0) + 1;
			return acc;
		}, {});

		// Find day with most tracks
		const mostTracksInDay = Object.entries(tracksPerDay).reduce(
			(max, [date, count]) =>
				count > (max.count || 0) ? { date, count } : max,
			{}
		);

		// Calculate streaks
		const allDates = new Set(uniqueDates);
		const missedDays = [];
		let currentDate = new Date(firstDate);
		const endDate = new Date(lastDate);

		while (currentDate <= endDate) {
			const dateStr = currentDate.toISOString().split("T")[0];
			if (!allDates.has(dateStr)) {
				missedDays.push(dateStr);
			}
			currentDate.setDate(currentDate.getDate() + 1);
		}

		// streaks
		let currentStreak = 0;
		let maxStreak = 0;
		let allStreaks = [];
		let tempStreak = 0;

		for (let i = uniqueDates.length - 1; i >= 0; i--) {
			const currentDate = new Date(uniqueDates[i]);
			const previousDate =
				i > 0 ? new Date(uniqueDates[i - 1]) : null;

			if (previousDate) {
				const dayDiff = Math.round(
					(currentDate - previousDate) / (1000 * 60 * 60 * 24)
				);
				if (dayDiff === 1) {
					tempStreak++;
				} else {
					if (tempStreak > 0) {
						allStreaks.push(tempStreak + 1);
					}
					tempStreak = 0;
				}
			}

			// current streak
			if (i === uniqueDates.length - 1) {
				const today = new Date();
				const lastScrobbleDate = new Date(
					uniqueDates[uniqueDates.length - 1]
				);
				const daysSinceLastScrobble = Math.round(
					(today - lastScrobbleDate) / (1000 * 60 * 60 * 24)
				);

				if (daysSinceLastScrobble <= 1) {
					currentStreak = 1;
					while (
						i > 0 &&
						new Date(uniqueDates[i]) -
							new Date(uniqueDates[i - 1]) ===
							1000 * 60 * 60 * 24
					) {
						currentStreak++;
						i--;
					}
				}
			}
		}

		if (tempStreak > 0) {
			allStreaks.push(tempStreak + 1);
		}
		maxStreak = Math.max(...allStreaks, currentStreak);

		// average tracks per listening day
		const averageTracksPerListeningDay =
			Math.round((totalTracks / uniqueDates.length) * 10) / 10;

		// listening percentage
		const listeningPercentage =
			Math.round((uniqueDates.length / totalDays) * 100 * 10) / 10;

		return {
			total_tracks: totalTracks,
			total_days_analyzed: totalDays,
			days_with_scrobbles: uniqueDates.length,
			listening_percentage: listeningPercentage,
			average_tracks_per_listening_day: averageTracksPerListeningDay,
			current_streak: currentStreak,
			max_streak: maxStreak,
			all_streaks: allStreaks,
			most_tracks_in_day: mostTracksInDay,
			missed_days: missedDays,
			first_date: firstDate,
			last_date: lastDate,
		};
	};

	return (
		<Container
			maxWidth='lg'
			sx={{
				py: 4,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				width: "100%",
				maxWidth: { sm: "600px", md: "900px", lg: "1200px" },
				mx: "auto",
			}}
		>
			<Typography variant='h3' gutterBottom align='center'>
				Last.fm Streak Analyzer
			</Typography>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					fetchStats();
				}}
			>
				<Box sx={{ mb: 4 }}>
					<TextField
						fullWidth
						label='Last.fm Username'
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						sx={{ mb: 2 }}
					/>
					<Button
						variant='contained'
						fullWidth
						type='submit'
						disabled={loading || !username}
					>
						Analyze Listening History
					</Button>
				</Box>
			</form>

			{loading && (
				<Box sx={{ width: "100%", mb: 4 }}>
					<LinearProgress variant='determinate' value={progress} />
					<Typography
						variant='body2'
						color='text.secondary'
						align='center'
						sx={{ mt: 1 }}
					>
						Fetching listening history... ({pages}/{totalPages}){" "}
						{estimatedTimeRemaining && (
							<>
								~
								{estimatedTimeRemaining > 60
									? `${Math.floor(estimatedTimeRemaining / 60)}m ${
											estimatedTimeRemaining % 60
									  }s`
									: `${estimatedTimeRemaining}s`}
							</>
						)}
					</Typography>
				</Box>
			)}

			{error && (
				<Typography color='error' align='center'>
					{error}
				</Typography>
			)}

			{stats && (
				<Box
					display='grid'
					gridTemplateColumns='repeat(12, 1fr)'
					gap={3}
				>
					<Box gridColumn='span 12'>
						<Card
							sx={{
								background:
									"linear-gradient(45deg, #FF9800 30%, #FFB74D 90%)",
								color: "white",
								boxShadow: "0 8px 16px rgba(255, 152, 0, 0.3)",
							}}
						>
							<CardContent sx={{ p: 3 }}>
								<Typography
									variant='h5'
									gutterBottom
									sx={{
										fontWeight: 700,
										borderBottom:
											"2px solid rgba(255, 255, 255, 0.3)",
										pb: 1,
										mb: 2,
									}}
								>
									Overall Statistics
								</Typography>
								<Box
									sx={{
										display: "grid",
										gridTemplateColumns: "repeat(2, 1fr)",
										gap: 3,
									}}
								>
									<Typography sx={{ fontSize: "1.1rem" }}>
										<span style={{ opacity: 0.9 }}>
											Total Tracks Scrobbled:
										</span>
										<br />
										<span
											style={{ fontSize: "1.8rem", fontWeight: 700 }}
										>
											{stats.total_tracks}
										</span>
									</Typography>
									<Typography sx={{ fontSize: "1.1rem" }}>
										<span style={{ opacity: 0.9 }}>
											Days Analyzed:
										</span>
										<br />
										<span
											style={{ fontSize: "1.8rem", fontWeight: 700 }}
										>
											{stats.total_days_analyzed}
										</span>
									</Typography>
									<Typography sx={{ fontSize: "1.1rem" }}>
										<span style={{ opacity: 0.9 }}>
											Listening Percentage:
										</span>
										<br />
										<span
											style={{ fontSize: "1.8rem", fontWeight: 700 }}
										>
											{stats.listening_percentage}%
										</span>
									</Typography>
									<Typography sx={{ fontSize: "1.1rem" }}>
										<span style={{ opacity: 0.9 }}>
											Average Tracks/Day:
										</span>
										<br />
										<span
											style={{ fontSize: "1.8rem", fontWeight: 700 }}
										>
											{stats.average_tracks_per_listening_day}
										</span>
									</Typography>
								</Box>
							</CardContent>
						</Card>
					</Box>

					<Box gridColumn={{ xs: "span 12", md: "span 6" }}>
						<Card
							sx={{
								background:
									"linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)",
								color: "white",
								boxShadow: "0 8px 16px rgba(33, 150, 243, 0.3)",
							}}
						>
							<CardContent sx={{ p: 3 }}>
								<Typography
									variant='h5'
									gutterBottom
									sx={{
										fontWeight: 700,
										borderBottom:
											"2px solid rgba(255, 255, 255, 0.3)",
										pb: 1,
										mb: 2,
									}}
								>
									Streak Information
								</Typography>
								<Typography
									variant='h4'
									sx={{
										mb: 2,
										display: "flex",
										alignItems: "center",
										gap: 1,
									}}
								>
									<span style={{ fontSize: "0.8em", opacity: 0.9 }}>
										Current Streak:
									</span>
									<span style={{ fontWeight: 700 }}>
										{stats.current_streak}
									</span>
									<span style={{ fontSize: "0.7em", opacity: 0.8 }}>
										days
									</span>
								</Typography>
								<Typography
									sx={{
										mb: 1.5,
										fontSize: "1.1rem",
										opacity: 0.9,
									}}
								>
									Longest Streak:{" "}
									<strong>{stats.max_streak} days</strong>
								</Typography>
								<Typography
									sx={{
										fontSize: "1.1rem",
										opacity: 0.9,
									}}
								>
									Recent Streaks:{" "}
									<strong>
										{stats.all_streaks.slice(0, 2).join(", ")} days
									</strong>
								</Typography>
							</CardContent>
						</Card>
					</Box>

					<Box gridColumn={{ xs: "span 12", md: "span 6" }}>
						<Card
							sx={{
								background:
									"linear-gradient(45deg, #4CAF50 30%, #81C784 90%)",
								color: "white",
								boxShadow: "0 8px 16px rgba(76, 175, 80, 0.3)",
								height: "100%",
							}}
						>
							<CardContent sx={{ p: 3 }}>
								<Typography
									variant='h5'
									gutterBottom
									sx={{
										fontWeight: 700,
										borderBottom:
											"2px solid rgba(255, 255, 255, 0.3)",
										pb: 1,
										mb: 2,
									}}
								>
									Most Active Day
								</Typography>
								<Typography
									variant='h4'
									sx={{
										mb: 2,
										display: "flex",
										flexDirection: "column",
										gap: 1,
									}}
								>
									<span style={{ fontSize: "0.7em", opacity: 0.9 }}>
										{stats.most_tracks_in_day.date}
									</span>
									<span style={{ fontWeight: 700 }}>
										{stats.most_tracks_in_day.count}
										<span style={{ fontSize: "0.7em", opacity: 0.8 }}>
											{" "}
											tracks
										</span>
									</span>
								</Typography>
							</CardContent>
						</Card>
					</Box>

					{stats.missed_days.length > 0 && (
						<Box gridColumn='span 12'>
							<Card
								sx={{
									background:
										"linear-gradient(45deg, #9C27B0 30%, #BA68C8 90%)",
									color: "white",
									boxShadow: "0 8px 16px rgba(156, 39, 176, 0.3)",
								}}
							>
								<CardContent sx={{ p: 3 }}>
									<Typography
										variant='h5'
										gutterBottom
										sx={{
											fontWeight: 700,
											borderBottom:
												"2px solid rgba(255, 255, 255, 0.3)",
											pb: 1,
											mb: 2,
										}}
									>
										Missed Days
									</Typography>
									<List
										dense
										sx={{
											display: "grid",
											gridTemplateColumns: {
												xs: "1fr",
												sm: "repeat(2, 1fr)",
												md: "repeat(3, 1fr)",
											},
											gap: 2,
										}}
									>
										{stats.missed_days.slice(0, 5).map((day) => (
											<ListItem
												key={day}
												sx={{
													background: "rgba(255, 255, 255, 0.1)",
													borderRadius: 1,
													mb: 1,
												}}
											>
												<ListItemText
													primary={day}
													sx={{
														"& .MuiListItemText-primary": {
															fontWeight: 500,
														},
													}}
												/>
											</ListItem>
										))}
										{stats.missed_days.length > 5 && (
											<ListItem sx={{ opacity: 0.8 }}>
												<ListItemText
													primary={`... and ${
														stats.missed_days.length - 5
													} more`}
												/>
											</ListItem>
										)}
									</List>
								</CardContent>
							</Card>
						</Box>
					)}
				</Box>
			)}
		</Container>
	);
}

export default App;
