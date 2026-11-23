/**
 * Paste your OpenRouter API key in CONFIG.OPENROUTER_API_KEY to enable AI chat.
 * Optional RapidAPI avatar settings: if left empty or if a request/quota fails,
 * colored initial circles are shown automatically.
 */
const CONFIG = {
  OPENROUTER_API_KEY: "",
  OPENROUTER_URL: "https://openrouter.ai/api/v1/chat/completions",
  OPENROUTER_MODEL: "openrouter/free",
  RAPIDAPI_KEY: "",
  RAPIDAPI_HOST: "",
  RAPIDAPI_AVATAR_URL: "",
  MAX_TWEET_CHARS: 280
};

const ENDPOINTS = {
  users: "https://jsonplaceholder.typicode.com/users",
  posts: "https://jsonplaceholder.typicode.com/posts",
  comments: "https://jsonplaceholder.typicode.com/comments"
};

const PALETTE = [
  { bg: "#e3f2fd", fg: "#1d9bf0" },
  { bg: "#e8f5e9", fg: "#2e7d32" },
  { bg: "#fff3e0", fg: "#ef6c00" },
  { bg: "#f3e5f5", fg: "#7b1fa2" },
  { bg: "#fce4ec", fg: "#c2185b" }
];

const WHO_TO_FOLLOW = [
  { name: "Ann Gathara", username: "anngathara" },
  { name: "Alex Wasikwe", username: "alexwasikwe" },
  { name: "Johnford Odour", username: "johnfordodour" },
  { name: "Christabel Anyango", username: "christabelanyango" }
];

const MY_POSTS = [
  "Built my first interactive layout with HTML, CSS, and JavaScript. Seeing a button react to a click for the first time never gets old.",
  "Good reporting asks the right questions; good code breaks a big problem into tiny, testable pieces. Both start with curiosity.",
  "Arrays and loops turned repetitive code into neat, reusable patterns today. Small mental models make a huge difference.",
  "Finding Elements: `getElementById` and `querySelector` make it easy to pinpoint exact parts of the page and update them on the fly.",
  "Adding `addEventListener` gave the page real reactions—from toggling comments and likes to opening profiles and chat panels.",
  "Loading users, posts, and comments in parallel with `Promise.all` keeps the feed moving without unnecessary waiting.",
  "Tuning the layout from a desktop sidebar and right panel to a mobile bottom bar makes the app feel right at home on any screen.",
  "A missing bracket or typo used to stop me in my tracks; now checking the console helps me spot what went wrong fast.",
  "Using the AI drawer to summarize posts and ask follow-up questions turns long threads into quick takeaways.",
  "Writing code a little every day, fixing small bugs and shipping small features, adds up faster than waiting for perfection."
];

const state = {
  view: "home", // "home" | "profile"
  activeUserId: 1,
  loggedInUserId: 1,
  profileName: "Lets Code",
  profileHandle: "letscode",
  profileImageUrl: localStorage.getItem("twitterCloneProfileImage") || "",
  editingProfile: false,
  users: [],
  usersById: new Map(),
  posts: [],
  commentsByPostId: new Map(),
  openComments: new Set(),
  likedPosts: new Set(),
  retweetedPosts: new Set(),
  likeCounts: new Map(),
  retweetCounts: new Map(),
  followingIds: new Set([2, 3]),
  followerCounts: new Map(),
  followingCounts: new Map(),
  avatarUrls: new Map(),
  avatarApiFailed: false,
  composeText: "",
  isLoading: true,
  loadError: null,
  chatHistory: [
    {
      role: "system",
      content: "You are a helpful AI assistant inside a Twitter clone app. Keep answers clear and concise."
    }
  ],
  isAiThinking: false
};

const viewContainer = document.getElementById("viewContainer");
const pageTitle = document.getElementById("pageTitle");
const backToHomeBtn = document.getElementById("backToHomeBtn");
const whoToFollowList = document.getElementById("whoToFollowList");
const fabAi = document.getElementById("fabAi");
const aiPanel = document.getElementById("aiPanel");
const closeAiBtn = document.getElementById("closeAiBtn");
const aiMessages = document.getElementById("aiMessages");
const aiForm = document.getElementById("aiForm");
const aiInput = document.getElementById("aiInput");
const aiSendBtn = document.getElementById("aiSendBtn");

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getInitials(name = "U") {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getPaletteForId(id = 1) {
  return PALETTE[Math.abs(Number(id) || 1) % PALETTE.length];
}

function renderAvatarHtml(user, sizeClass = "") {
  const id = user ? user.id : 1;
  const name = user ? user.name : "User";
  const initials = getInitials(name);
  const colors = getPaletteForId(id);
  const avatarUrl =
    id === state.loggedInUserId && state.profileImageUrl
      ? state.profileImageUrl
      : (!state.avatarApiFailed ? state.avatarUrls.get(id) : null);

  if (avatarUrl) {
    return `
      <span class="avatar ${sizeClass}" style="background:${colors.bg};color:${colors.fg};">
        <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(name)}" onerror="this.parentElement.textContent='${escapeHtml(initials)}'" />
      </span>
    `;
  }

  return `
    <span class="avatar ${sizeClass}" style="background:${colors.bg};color:${colors.fg};">
      ${escapeHtml(initials)}
    </span>
  `;
}

async function tryLoadOptionalAvatars(users) {
  if (
    !CONFIG.RAPIDAPI_KEY ||
    !CONFIG.RAPIDAPI_HOST ||
    !CONFIG.RAPIDAPI_AVATAR_URL ||
    state.avatarApiFailed
  ) {
    return;
  }

  try {
    for (const user of users) {
      const separator = CONFIG.RAPIDAPI_AVATAR_URL.includes("?") ? "&" : "?";
      const url = `${CONFIG.RAPIDAPI_AVATAR_URL}${separator}name=${encodeURIComponent(user.name)}`;
      const res = await fetch(url, {
        headers: {
          "X-RapidAPI-Key": CONFIG.RAPIDAPI_KEY,
          "X-RapidAPI-Host": CONFIG.RAPIDAPI_HOST
        }
      });

      if (!res.ok) {
        state.avatarApiFailed = true;
        state.avatarUrls.clear();
        renderAll();
        return;
      }

      const data = await res.json();
      const imgUrl = data?.url || data?.avatar || data?.image || null;
      if (imgUrl) {
        state.avatarUrls.set(user.id, imgUrl);
      }
    }
    renderAll();
  } catch {
    state.avatarApiFailed = true;
    state.avatarUrls.clear();
    renderAll();
  }
}

async function fetchInitialData() {
  state.isLoading = true;
  state.loadError = null;
  renderMainView();

  try {
    const [usersRes, postsRes, commentsRes] = await Promise.all([
      fetch(ENDPOINTS.users),
      fetch(ENDPOINTS.posts),
      fetch(ENDPOINTS.comments)
    ]);

    if (!usersRes.ok || !postsRes.ok || !commentsRes.ok) {
      throw new Error("Failed to load data from JSONPlaceholder.");
    }

    const [users, posts, comments] = await Promise.all([
      usersRes.json(),
      postsRes.json(),
      commentsRes.json()
    ]);

    state.users = users;
    state.usersById.clear();
    users.forEach((user, index) => {
      if (user.id === state.loggedInUserId) {
        user.name = state.profileName;
        user.username = state.profileHandle;
      }
      state.usersById.set(user.id, user);
      state.followerCounts.set(user.id, 1200 + index * 310);
      state.followingCounts.set(user.id, 180 + index * 24);
    });

    const myPosts = MY_POSTS.map((body, index) => ({
      id: 1001 + index,
      userId: state.loggedInUserId,
      title: "",
      body
    }));
    state.posts = myPosts;
    state.likeCounts.clear();
    state.retweetCounts.clear();
    myPosts.forEach((post, index) => {
      state.likeCounts.set(post.id, 12 + index * 3);
      state.retweetCounts.set(post.id, 4 + index * 2);
    });

    state.commentsByPostId.clear();
    myPosts.forEach((post, index) => {
      const commentCounts = [4, 6, 8, 12];
      const commentCount = commentCounts[index % commentCounts.length];
      const readerNames = [
        "Alex M.", "Beatrice N.", "Chris K.", "Daniel O.",
        "Emma W.", "Faith A.", "George L.", "Hannah M.",
        "Ian P.", "Joy C.", "Kevin R.", "Lydia T."
      ];
      const commentTexts = [
        "This is a clear and practical takeaway.",
        "I tried a similar approach and it really helped.",
        "The example makes this much easier to understand.",
        "Great reminder to keep building consistently.",
        "This encouraged me to practice the fundamentals again.",
        "Breaking the problem into small pieces is so useful.",
        "Thanks for sharing what you learned along the way.",
        "I like how this connects theory with real practice.",
        "This is exactly the kind of insight I needed today.",
        "Simple explanations like this make learning more approachable.",
        "I appreciate the honesty and the small steps forward.",
        "Looking forward to seeing the next project update."
      ];
      const postComments = Array.from({ length: commentCount }, (_, commentIndex) => ({
        name: readerNames[commentIndex],
        email: `${readerNames[commentIndex].toLowerCase().replace(/[^a-z]/g, "")}@example.com`,
        body: `${commentTexts[commentIndex]} (Post ${index + 1})`
      }));
      state.commentsByPostId.set(post.id, postComments);
    });
    comments.forEach((comment) => {
      const group = state.commentsByPostId.get(comment.postId) || [];
      group.push(comment);
      state.commentsByPostId.set(comment.postId, group);
    });

    state.isLoading = false;
    renderAll();
    tryLoadOptionalAvatars(users);
  } catch (error) {
    state.isLoading = false;
    state.loadError = error.message || "Unable to fetch posts, users, and comments.";
    renderMainView();
  }
}

function renderAll() {
  updateNavButtons();
  renderWhoToFollow();
  renderMainView();
  renderChatMessages();
}

function updateNavButtons() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    const nav = btn.dataset.nav;
    const isActive =
      (nav === "home" && state.view === "home" && !aiPanel.classList.contains("open")) ||
      (nav === "profile" &&
        state.view === "profile" &&
        state.activeUserId === state.loggedInUserId &&
        !aiPanel.classList.contains("open")) ||
      (nav === "ai" && aiPanel.classList.contains("open"));
    btn.classList.toggle("active", isActive);
  });
}

function renderWhoToFollow() {
  if (!whoToFollowList) return;
  const suggestions = state.users
    .filter((user) => user.id !== state.loggedInUserId)
    .slice(0, 4);

  whoToFollowList.innerHTML = suggestions
    .map((user, index) => {
      const suggestedUser = WHO_TO_FOLLOW[index];
      const name = suggestedUser?.name || user.name;
      const username = suggestedUser?.username || user.username;
      const isFollowing = state.followingIds.has(user.id);
      return `
        <div class="suggestion-item">
          <div class="suggestion-info" data-open-profile="${user.id}">
            ${renderAvatarHtml({ ...user, name })}
            <div class="suggestion-text">
              <div class="name">${escapeHtml(name)}</div>
              <div class="handle">@${escapeHtml(username)}</div>
            </div>
          </div>
          <button
            class="btn-outline ${isFollowing ? "following" : ""}"
            data-toggle-follow="${user.id}"
            type="button"
          >
            ${isFollowing ? "Following" : "Follow"}
          </button>
        </div>
      `;
    })
    .join("");
}

function renderMainView() {
  if (state.isLoading) {
    pageTitle.textContent = state.view === "home" ? "Home" : "Profile";
    backToHomeBtn.style.display = "none";
    viewContainer.innerHTML = `
      <div class="state-box">
        <div class="spinner" role="status" aria-label="Loading"></div>
        <p>Loading feed...</p>
      </div>
    `;
    return;
  }

  if (state.loadError) {
    pageTitle.textContent = "Home";
    backToHomeBtn.style.display = "none";
    viewContainer.innerHTML = `
      <div class="error-banner">
        <strong>Error:</strong> ${escapeHtml(state.loadError)}
        <div style="margin-top: 10px;">
          <button id="retryFetchBtn" class="btn-primary" type="button">Try Again</button>
        </div>
      </div>
    `;
    document.getElementById("retryFetchBtn")?.addEventListener("click", fetchInitialData);
    return;
  }

  if (state.view === "profile") {
    renderProfileView(state.activeUserId);
  } else {
    renderHomeView();
  }
}

function renderComposeBox() {
  const loggedInUser = state.usersById.get(state.loggedInUserId) || {
    id: 1,
    name: "Leanne Graham",
    username: "Bret"
  };
  const remaining = CONFIG.MAX_TWEET_CHARS - state.composeText.length;
  const counterClass = remaining < 0 ? "over" : remaining <= 20 ? "warn" : "";
  const isInvalid = state.composeText.trim().length === 0 || remaining < 0;

  return `
    <div class="compose-box">
      <div style="cursor: pointer;" data-open-profile="${loggedInUser.id}">
        ${renderAvatarHtml(loggedInUser)}
      </div>
      <div class="compose-body">
        <textarea
          id="composeTextarea"
          class="compose-textarea"
          placeholder="What is happening?"
          aria-label="What is happening?"
        >${escapeHtml(state.composeText)}</textarea>
        <div class="compose-footer">
          <span id="charCounter" class="char-counter ${counterClass}">${remaining}</span>
          <button id="tweetSubmitBtn" class="btn-primary" type="button" ${isInvalid ? "disabled" : ""}>
            Post
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderPostCard(post) {
  const author = state.usersById.get(post.userId) || {
    id: post.userId,
    name: `User ${post.userId}`,
    username: `user${post.userId}`
  };
  const postComments = state.commentsByPostId.get(post.id) || [];
  const isCommentsOpen = state.openComments.has(post.id);
  const isLiked = state.likedPosts.has(post.id);
  const isRetweeted = state.retweetedPosts.has(post.id);
  const likeCount = state.likeCounts.get(post.id) ?? 0;
  const retweetCount = state.retweetCounts.get(post.id) ?? 0;

  return `
    <article class="post-card" data-post-id="${post.id}">
      <div style="cursor: pointer;" data-open-profile="${author.id}">
        ${renderAvatarHtml(author)}
      </div>
      <div class="post-content">
        <div class="post-author-row">
          <button class="author-name" data-open-profile="${author.id}" type="button">
            ${escapeHtml(author.name)}
          </button>
          <span class="author-handle">@${escapeHtml(author.username)}</span>
        </div>
        ${post.title ? `<div class="post-title">${escapeHtml(post.title)}</div>` : ""}
        <p class="post-body">${escapeHtml(post.body)}</p>
        <div class="post-actions">
          <button class="action-btn" data-toggle-comments="${post.id}" type="button">
            Comments (${postComments.length})
          </button>
          <button class="action-btn ${isRetweeted ? "retweeted" : ""}" data-toggle-retweet="${post.id}" type="button">
            Repost (${retweetCount})
          </button>
          <button class="action-btn ${isLiked ? "liked" : ""}" data-toggle-like="${post.id}" type="button">
            Like (${likeCount})
          </button>
          <button class="action-btn" data-summarize-post="${post.id}" type="button">
            Summarize with AI
          </button>
        </div>

        ${
          isCommentsOpen
            ? `
              <div class="comments-box">
                ${
                  postComments.length === 0
                    ? `<div class="comment-item">No comments yet.</div>`
                    : postComments
                        .map(
                          (comment) => `
                            <div class="comment-item">
                              <div class="comment-meta">
                                ${escapeHtml(comment.name)}
                                <span class="comment-email">&lt;${escapeHtml(comment.email)}&gt;</span>
                              </div>
                              <div>${escapeHtml(comment.body)}</div>
                            </div>
                          `
                        )
                        .join("")
                }
              </div>
            `
            : ""
        }
      </div>
    </article>
  `;
}

function renderHomeView() {
  pageTitle.textContent = "Home";
  backToHomeBtn.style.display = "none";

  const postsHtml = state.posts.map((post) => renderPostCard(post)).join("");
  viewContainer.innerHTML = `
    ${renderComposeBox()}
    <div id="feedList">${postsHtml}</div>
  `;

  bindComposeEvents();
}

function renderProfileView(userId) {
  const user = state.usersById.get(userId) || state.users[0];
  if (!user) return;

  pageTitle.textContent = user.name;
  backToHomeBtn.style.display = "inline-block";

  const userPosts = state.posts.filter((post) => post.userId === user.id);
  const isFollowing = state.followingIds.has(user.id);
  const isSelf = user.id === state.loggedInUserId;
  const baseFollowers = state.followerCounts.get(user.id) ?? 1200;
  const followers = baseFollowers + (isFollowing ? 1 : 0);
  const following = state.followingCounts.get(user.id) ?? 200;
  const companyName = isSelf ? "All Times Media" : user.company?.name || "Independent";
  const city = isSelf ? "Kenya" : user.address?.city || "Unknown City";
  const email = isSelf ? "alltimesmedia66@gmail.com" : user.email || "user@example.com";
  const bio = "Writing first, code second. Come let's learn together.";

  viewContainer.innerHTML = `
    <div class="cover-banner"></div>
    <div class="profile-header">
      <div class="profile-top-row">
        ${renderAvatarHtml(user, "lg")}
        ${
          isSelf
            ? `<button class="btn-outline" id="editProfileBtn" type="button">Edit Profile</button>`
            : `<button class="btn-outline ${isFollowing ? "following" : ""}" data-toggle-follow="${user.id}" type="button">
                ${isFollowing ? "Following" : "Follow"}
               </button>`
        }
      </div>
      ${
        state.editingProfile && isSelf
          ? `
            <form id="editProfileForm" class="edit-profile-form">
              <label>Profile picture<input id="profileImageInput" type="file" accept="image/*" /></label>
              <div class="edit-profile-actions">
                <button class="btn-outline" id="cancelProfileEdit" type="button">Cancel</button>
                <button class="btn-primary" type="submit">Save</button>
              </div>
            </form>
          `
          : `
            <div class="profile-name">${escapeHtml(user.name)}</div>
            <div class="profile-handle">@${escapeHtml(user.username)}</div>
            <p class="profile-bio">${escapeHtml(bio)}</p>
          `
      }
      <div class="profile-meta">
        <span>Works at ${escapeHtml(companyName)}</span>
        <span>${escapeHtml(city)}</span>
        <span>${escapeHtml(email)}</span>
      </div>
      <div class="profile-stats">
        <span><strong>${following.toLocaleString()}</strong> Following</span>
        <span><strong>${followers.toLocaleString()}</strong> Followers</span>
        <span><strong>${userPosts.length}</strong> Posts</span>
      </div>
    </div>
    <div class="profile-posts-heading">Posts by ${escapeHtml(user.name.split(" ")[0])}</div>
    <div>
      ${
        userPosts.length > 0
          ? userPosts.map((post) => renderPostCard(post)).join("")
          : `<div class="state-box">No posts yet.</div>`
      }
    </div>
  `;

  bindProfileEditEvents();
}

function bindProfileEditEvents() {
  document.getElementById("editProfileBtn")?.addEventListener("click", () => {
    state.editingProfile = true;
    renderMainView();
  });

  document.getElementById("cancelProfileEdit")?.addEventListener("click", () => {
    state.editingProfile = false;
    renderMainView();
  });

  document.getElementById("editProfileForm")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const imageInput = document.getElementById("profileImageInput");
    const selectedFile = imageInput?.files?.[0];
    if (!selectedFile) {
      state.editingProfile = false;
      renderAll();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      state.profileImageUrl = String(reader.result);
      localStorage.setItem("twitterCloneProfileImage", state.profileImageUrl);
      state.editingProfile = false;
      renderAll();
    };
    reader.readAsDataURL(selectedFile);
  });
}

function bindComposeEvents() {
  const textarea = document.getElementById("composeTextarea");
  const counter = document.getElementById("charCounter");
  const submitBtn = document.getElementById("tweetSubmitBtn");
  if (!textarea || !counter || !submitBtn) return;

  textarea.addEventListener("input", () => {
    state.composeText = textarea.value;
    const remaining = CONFIG.MAX_TWEET_CHARS - state.composeText.length;
    counter.textContent = String(remaining);
    counter.className = "char-counter";
    if (remaining < 0) counter.classList.add("over");
    else if (remaining <= 20) counter.classList.add("warn");
    submitBtn.disabled = state.composeText.trim().length === 0 || remaining < 0;
  });

  submitBtn.addEventListener("click", () => {
    const text = state.composeText.trim();
    if (!text || text.length > CONFIG.MAX_TWEET_CHARS) return;

    const newPost = {
      id: Date.now(),
      userId: state.loggedInUserId,
      title: "",
      body: text
    };
    state.posts.unshift(newPost);
    state.likeCounts.set(newPost.id, 1);
    state.retweetCounts.set(newPost.id, 1);
    state.commentsByPostId.set(newPost.id, [
      {
        name: "Community",
        email: "community@example.com",
        body: "Welcome to the conversation!"
      }
    ]);
    state.composeText = "";
    renderMainView();
  });
}

document.addEventListener("click", (event) => {
  const navBtn = event.target.closest("[data-nav]");
  if (navBtn) {
    const target = navBtn.dataset.nav;
    if (target === "home") {
      state.view = "home";
      aiPanel.classList.remove("open");
      renderAll();
    } else if (target === "profile") {
      state.view = "profile";
      state.activeUserId = state.loggedInUserId;
      aiPanel.classList.remove("open");
      renderAll();
    } else if (target === "ai") {
      openAiPanel();
    }
    return;
  }

  const profileTrigger = event.target.closest("[data-open-profile]");
  if (profileTrigger) {
    const userId = Number(profileTrigger.dataset.openProfile);
    if (userId) {
      state.view = "profile";
      state.activeUserId = userId;
      aiPanel.classList.remove("open");
      renderAll();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    return;
  }

  const commentBtn = event.target.closest("[data-toggle-comments]");
  if (commentBtn) {
    const postId = Number(commentBtn.dataset.toggleComments);
    if (state.openComments.has(postId)) {
      state.openComments.delete(postId);
    } else {
      state.openComments.add(postId);
    }
    renderMainView();
    return;
  }

  const likeBtn = event.target.closest("[data-toggle-like]");
  if (likeBtn) {
    const postId = Number(likeBtn.dataset.toggleLike);
    const current = state.likeCounts.get(postId) ?? 0;
    if (state.likedPosts.has(postId)) {
      state.likedPosts.delete(postId);
      state.likeCounts.set(postId, Math.max(0, current - 1));
    } else {
      state.likedPosts.add(postId);
      state.likeCounts.set(postId, current + 1);
    }
    renderMainView();
    return;
  }

  const retweetBtn = event.target.closest("[data-toggle-retweet]");
  if (retweetBtn) {
    const postId = Number(retweetBtn.dataset.toggleRetweet);
    const current = state.retweetCounts.get(postId) ?? 0;
    if (state.retweetedPosts.has(postId)) {
      state.retweetedPosts.delete(postId);
      state.retweetCounts.set(postId, Math.max(0, current - 1));
    } else {
      state.retweetedPosts.add(postId);
      state.retweetCounts.set(postId, current + 1);
    }
    renderMainView();
    return;
  }

  const followBtn = event.target.closest("[data-toggle-follow]");
  if (followBtn) {
    const userId = Number(followBtn.dataset.toggleFollow);
    if (state.followingIds.has(userId)) {
      state.followingIds.delete(userId);
    } else {
      state.followingIds.add(userId);
    }
    renderWhoToFollow();
    if (state.view === "profile") renderMainView();
    return;
  }

  const summarizeBtn = event.target.closest("[data-summarize-post]");
  if (summarizeBtn) {
    const postId = Number(summarizeBtn.dataset.summarizePost);
    const post = state.posts.find((item) => item.id === postId);
    if (!post) return;

    const author = state.usersById.get(post.userId);
    const comments = state.commentsByPostId.get(post.id) || [];
    const commentsText =
      comments.length > 0
        ? comments.map((c, idx) => `${idx + 1}. ${c.name}: ${c.body}`).join("\n")
        : "No comments.";

    const promptText =
      `Summarize this post and its comments:\n\n` +
      `Author: ${author ? author.name : "Unknown"} (@${author ? author.username : "user"})\n` +
      `Title: ${post.title || "(none)"}\n` +
      `Post: ${post.body}\n\n` +
      `Comments:\n${commentsText}`;

    openAiPanel();
    sendMessageToAi(
      `Summarize ${author ? `${author.name.split(" ")[0]}'s` : "this"} post.`,
      promptText
    );
  }
});

backToHomeBtn.addEventListener("click", () => {
  state.view = "home";
  renderAll();
});

function openAiPanel() {
  aiPanel.classList.add("open");
  updateNavButtons();
  aiInput.focus();
}

fabAi.addEventListener("click", () => {
  aiPanel.classList.toggle("open");
  updateNavButtons();
  if (aiPanel.classList.contains("open")) {
    aiInput.focus();
  }
});

closeAiBtn.addEventListener("click", () => {
  aiPanel.classList.remove("open");
  updateNavButtons();
});

function renderChatMessages(errorText = "") {
  const visibleMessages = state.chatHistory.filter((msg) => msg.role !== "system");
  let html = "";

  visibleMessages.forEach((msg) => {
    html += `
      <div class="chat-bubble ${msg.role === "user" ? "user" : "assistant"}">
        ${escapeHtml(msg.content)}
      </div>
    `;
  });

  if (state.isAiThinking) {
    html += `<div class="chat-bubble assistant thinking">Thinking...</div>`;
  }

  if (errorText) {
    html += `<div class="chat-bubble assistant error">${escapeHtml(errorText)}</div>`;
  }

  aiMessages.innerHTML = html;
  aiMessages.scrollTop = aiMessages.scrollHeight;
}

function buildLocalPostSummary(promptText) {
  const postMatch = promptText.match(/Post:\s*(.+?)(?:\n\nComments:|$)/s);
  const commentsMatch = promptText.match(/Comments:\s*([\s\S]*)$/);
  const postText = postMatch?.[1]?.trim() || "the post";
  const commentLines = (commentsMatch?.[1] || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && line !== "No comments.");

  if (commentLines.length === 0) {
    return `Post summary: ${postText}\n\nThere are no comments to summarize.`;
  }

  return [
    `Post summary: ${postText}`,
    "",
    `The ${commentLines.length} comments are generally positive and reinforce themes such as consistent practice, clear explanations, and learning through small steps.`,
    "",
    "Key reactions:",
    ...commentLines.slice(0, 3).map((comment) => `- ${comment}`)
  ].join("\n");
}

async function sendMessageToAi(displayText, apiContent = displayText) {
  if (state.isAiThinking) return;

  if (!CONFIG.OPENROUTER_API_KEY) {
    state.chatHistory.push({ role: "user", content: displayText });
    if (apiContent.startsWith("Summarize this post and its comments:")) {
      state.chatHistory.push({
        role: "assistant",
        content: buildLocalPostSummary(apiContent)
      });
      renderChatMessages();
    } else {
      renderChatMessages(
        "Missing OpenRouter API key. Set CONFIG.OPENROUTER_API_KEY in script.js."
      );
    }
    return;
  }

  state.chatHistory.push({ role: "user", content: apiContent });
  state.isAiThinking = true;
  aiSendBtn.disabled = true;
  renderChatMessages();

  try {
    const res = await fetch(CONFIG.OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CONFIG.OPENROUTER_API_KEY}`
      },
      body: JSON.stringify({
        model: CONFIG.OPENROUTER_MODEL,
        messages: state.chatHistory
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || `OpenRouter request failed (${res.status})`);
    }

    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "No response received from OpenRouter.";

    state.chatHistory.push({ role: "assistant", content: reply });
    state.isAiThinking = false;
    aiSendBtn.disabled = false;
    renderChatMessages();
  } catch (error) {
    state.isAiThinking = false;
    aiSendBtn.disabled = false;
    renderChatMessages(error.message || "Error communicating with OpenRouter.");
  }
}

aiForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = aiInput.value.trim();
  if (!text) return;
  aiInput.value = "";
  sendMessageToAi(text, text);
});

renderChatMessages();
fetchInitialData();