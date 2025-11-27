import React, { useState, useEffect, useRef } from "react";

interface TimelineEvent {
  step: string;
  detail: string;
  timestamp: string;
}

interface JobTimeline {
  jobId: string;
  timeline: TimelineEvent[];
}

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"home" | "history">("home");
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  // Add state to track WS connection
  const [wsConnected, setWsConnected] = useState(false);

  const keys = Object.keys(localStorage).filter((key) =>
    key.startsWith("timeline-")
  );
  const savedHistory: JobTimeline[] = keys.map((key) => ({
    jobId: key.replace("timeline-", ""),
    timeline: JSON.parse(localStorage.getItem(key) || "[]"),
  }));

  // Sort by latest timestamp
  savedHistory.sort((a, b) => {
    const aLast = a.timeline[a.timeline.length - 1]?.timestamp || "";
    const bLast = b.timeline[b.timeline.length - 1]?.timestamp || "";
    return new Date(bLast).getTime() - new Date(aLast).getTime();
  });

  
  // const [history, setHistory] = useState<JobTimeline[]>(() => {
  //   const keys = Object.keys(localStorage).filter((key) =>
  //     key.startsWith("timeline-")
  //   );
  //   return keys
  //     .slice()
  //     .reverse()
  //     .map((key) => ({
  //       jobId: key.replace("timeline-", ""),
  //       timeline: JSON.parse(localStorage.getItem(key) || "[]"),
  //     }));
  // });
  const wsRef = useRef<WebSocket | null>(null);

  // Save timeline to localStorage whenever it updates
  useEffect(() => {
    if (jobId) {
      localStorage.setItem(`timeline-${jobId}`, JSON.stringify(timeline));
    }
  }, [timeline, jobId]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files && e.target.files[0];
    setFile(f || null);
  }

  const handleSubmit = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/upload`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    console.log("UPLOAD RESPONSE:", data);

    const newJobId = data.job_id;
    setJobId(newJobId);

    // Start a fresh timeline
    setTimeline([]);

    // Open WebSocket immediately
    const socket = new WebSocket(`${import.meta.env.VITE_WS_BACKEND_URL}${data.ws_path}`);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log("WS CONNECTED. SENDING START...");
      socket.send("start"); // starts backend process
      setWsConnected(true); // show warning message
    };

    socket.onmessage = (event) => {
      const msg: TimelineEvent = JSON.parse(event.data);
      console.log("TIMELINE EVENT:", msg);
      setTimeline((prev) => [...prev, msg]);
    };

    socket.onerror = (err) => {
      console.log("WS ERROR:", err);
    };

    socket.onclose = () => {
      console.log("WS CLOSED");
      setWsConnected(false);
    };
  };

  const formatDate = (ts: string) =>
    new Date(ts).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="w-screen min-h-screen flex flex-col items-center px-4 py-6">
      {/* NAV BAR */}
      <div className="backdrop-blur-md bg-white/70 border shadow-md rounded-full px-6 py-3 flex gap-6 mb-8">
        {["home", "history"].map((tab) => (
          <p
            key={tab}
            className={`cursor-pointer text-xl font-semibold transition text-black ${
              activeTab === tab ? "text-blue-600" : "hover:text-gray-800"
            }`}
            onClick={() => setActiveTab(tab as "home" | "history")}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </p>
        ))}
      </div>

      {/* Warning Banner */}
      {wsConnected && (
        <div className="bg-yellow-100 border-l-4 border-yellow-400 text-yellow-700 p-3 rounded mb-4">
          <p className="text-sm">
            ⚠️ AI Agent working in progress. Do not reload or close the page, or you may lose updates.
          </p>
        </div>
      )}

      <div className="w-full max-w-2xl space-y-6">
        {activeTab === "home" && (
          <>
            <h1 className="text-center text-lg my-3 font-extrabold text-gray-800 tracking-tight">
              RILA AI Agent
            </h1>

            {/* Upload Section */}
            <div className="bg-white border rounded-2xl p-6 space-y-4 shadow-sm">
              <label className="text-sm font-medium text-gray-700">
                Upload a .docx file
              </label>

              <input
                type="file"
                accept=".docx"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-700 border rounded-lg p-2 bg-gray-50"
              />

              <button
                onClick={handleSubmit}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Submit
              </button>
            </div>

            {/* Timeline */}
            <div className="mt-4">
              <h2 className="text-xl font-semibold mb-3 text-gray-800">
                Processing Timeline
              </h2>

              {timeline.length === 0 ? (
                <p className="text-gray-500 italic">No updates yet...</p>
              ) : (
                <ul className="space-y-4">
                  {timeline
                    .slice()
                    .reverse()
                    .map((event, idx) => (
                      <li
                        key={idx}
                        className="bg-white border rounded-xl p-4 shadow-sm hover:shadow transition"
                      >
                        <p className="font-semibold text-blue-700 text-lg">
                          {event.step}
                        </p>
                        <p className="text-gray-700 mt-1">{event.detail}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {formatDate(event.timestamp)}
                        </p>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </>
        )}

        {activeTab === "history" && (
          <>
            {/* <h2 className="text-center text-3xl font-extrabold text-gray-800 tracking-tight">
              History
            </h2> */}

            {savedHistory.length === 0 ? (
              <p className="text-gray-500 italic mt-4">No past timelines.</p>
            ) : (
              <div className="space-y-6 mt-4">
                {savedHistory
                  // .slice()
                  // .reverse()
                  .map(({ jobId, timeline }) => (
                    <div
                      key={jobId}
                      className="bg-white border rounded-2xl p-4 shadow-sm"
                    >
                      <p className="font-semibold text-lg text-blue-700 mb-2">
                        Job ID: {jobId}
                      </p>
                      <ul className="space-y-2">
                        {timeline
                          .slice()
                          .reverse()
                          .map((event, idx) => (
                            <li
                              key={idx}
                              className="bg-gray-50 border rounded-lg p-2"
                            >
                              <p className="font-semibold text-gray-800">
                                {event.step}
                              </p>
                              <p className="text-gray-600">{event.detail}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                {formatDate(event.timestamp)}
                              </p>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
