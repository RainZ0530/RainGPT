import Head from "next/head";
import { useState, useRef, useEffect } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import styles from "@/styles/Home.module.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function Home() {
  const userProfile = {
    name: "Yulin (Rain) Zhai",
    bio:
      "In the meantime, please feel free to ask me about anything, and I will try my best to answer!",
  };

  // messages: each object is { sender: "user"|"bot", text: string, streaming?: boolean }
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: `Welcome to RainGPT 💧! I am the AI alter‐ego version of ${userProfile.name}; the real Rain is probably sleeping right now 😴. ${userProfile.bio}`,
      streaming: false,
    },
  ]);

  const [input, setInput] = useState("");
  const chatLogRef = useRef();

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    // 1) Append the user's message
    const userMsg = { sender: "user", text: input.trim(), streaming: false };
    setMessages((prev) => [...prev, userMsg]);

    // 2) Add a placeholder for the bot’s streaming reply
    const placeholder = { sender: "bot", text: "", streaming: true };
    setMessages((prev) => [...prev, placeholder]);

    // Build the history to send to API
    const apiMessages = messages.map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.text,
    }));
    apiMessages.push({ role: "user", content: input.trim() });

    try {
      // 3) Call the streaming endpoint
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) {
        console.error("Streaming error:", await response.text());
        // Mark placeholder as done to stop any loading indicator
        setMessages((prev) =>
          prev.map((m, idx) =>
            idx === prev.length - 1 ? { ...m, streaming: false } : m
          )
        );
        return;
      }

      // 4) Read the response stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let buffer = "";

      // Capture the index of the placeholder we just added
      let placeholderIndex;
      setMessages((prev) => {
        placeholderIndex = prev.length - 1;
        return prev;
      });

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop(); // last chunk may be incomplete

          for (const part of parts) {
            // Each part looks like "data: \"<token>\"" or "data: [DONE]"
            if (!part.startsWith("data: ")) continue;
            const raw = part.replace(/^data: /, "").trim();
            if (raw === "[DONE]") {
              // Mark streaming as finished
              setMessages((prev) =>
                prev.map((m, idx) =>
                  idx === placeholderIndex ? { ...m, streaming: false } : m
                )
              );
              reader.cancel();
              break;
            }
            // Parse the JSON‐escaped token string
            let token;
            try {
              token = JSON.parse(raw);
            } catch {
              continue;
            }
            // Append the token to the placeholder’s text
            setMessages((prev) =>
              prev.map((m, idx) =>
                idx === placeholderIndex
                  ? { ...m, text: m.text + token }
                  : m
              )
            );
          }
        }
      }
    } catch (err) {
      console.error("Fetch error:", err);
      // If an error occurs, stop the streaming placeholder
      setMessages((prev) =>
        prev.map((m) =>
          m.streaming ? { ...m, streaming: false } : m
        )
      );
    }

    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <Head>
        <title>{userProfile.name} Chatbot</title>
        <meta name="description" content="A ChatGPT‐style AI chatbot." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div
        className={`${styles.page} ${geistSans.variable} ${geistMono.variable}`}
        style={chatStyles.pageContainer}
      >
        <div style={chatStyles.chatContainer}>
          <div ref={chatLogRef} style={chatStyles.chatLog}>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={
                  msg.sender === "user"
                    ? chatStyles.userBubble
                    : chatStyles.botBubble
                }
              >
                {msg.text}
                {msg.streaming && <span className="blinker">▍</span>}
              </div>
            ))}
          </div>

          <div style={chatStyles.inputContainer}>
            <textarea
              style={chatStyles.textArea}
              placeholder="Type your question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button style={chatStyles.sendButton} onClick={sendMessage}>
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Optional: add a global style for the blinking cursor */}
      <style jsx global>{`
        .blinker {
          display: inline-block;
          margin-left: 2px;
          background-color: transparent;
          animation: blink 1s step-end infinite;
        }
        @keyframes blink {
          from,
          to {
            background-color: transparent;
          }
          50% {
            background-color: currentColor;
          }
        }
      `}</style>
    </>
  );
}

const chatStyles = {
  pageContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fafafa",
    minHeight: "100vh",
    padding: "1rem",
  },
  chatContainer: {
    width: "100%",
    maxWidth: "800px",
    height: "90vh",
    borderRadius: "12px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
    fontFamily: "Comic Sans MS, Comic Sans",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#fff",
  },
  chatLog: {
    flex: 1,
    padding: "1rem",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
  },
  // Bot bubble: lavender gradient + purple border + subtle shadow
  botBubble: {
    maxWidth: "100%",
    marginBottom: "1rem",
    padding: "0.75rem 1rem",
    background: "linear-gradient(to right, #D8C1FF 30%, #EBD4FF 70%)",
    border: "2px solid #B39DFF",
    borderRadius: "12px 12px 12px 0",
    boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
    alignSelf: "flex-start",
    lineHeight: "1.5",
    whiteSpace: "pre-wrap",
    color: "#000",
  },
  // User bubble: sky-blue gradient + deeper blue border + subtle shadow
  userBubble: {
    maxWidth: "100%",
    marginBottom: "1rem",
    padding: "0.75rem 1rem",
    background: "linear-gradient(to left, #AEDFFF 30%, #D0E8FF 70%)",
    border: "2px solid #7FC9FF",
    borderRadius: "12px 12px 0 12px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
    alignSelf: "flex-end",
    lineHeight: "1.5",
    whiteSpace: "pre-wrap",
    color: "#000",
  },
  inputContainer: {
    display: "flex",
    borderTop: "1px solid #ddd",
    padding: "0.5rem",
    alignItems: "flex-end",
  },
  textArea: {
    flex: 1,
    resize: "none",
    borderRadius: "8px",
    border: "1px solid #ccc",
    padding: "0.75rem",
    fontSize: "1rem",
    lineHeight: "1.5",
    marginRight: "0.5rem",
    height: "3rem",
  },
  sendButton: {
    background: "linear-gradient(to right, #A5D6A7, #388E3C)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "0.75rem 1.5rem",
    fontSize: "1rem",
    cursor: "pointer",
    alignSelf: "flex-end",
  },
};
