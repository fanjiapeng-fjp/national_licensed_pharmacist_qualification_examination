// ===== PROFILE =====
function showProfile() {
  var uid = localStorage.getItem("yspx_current_user");
  if (!uid) return;
  supabase.from("profiles").select("*").eq("id", uid).maybeSingle().then(function(r) {
    if (r.data) {
      document.getElementById("profileUsername").value = r.data.username || "";
      document.getElementById("profileName").value = r.data.name || "";
      document.getElementById("profileGender").value = r.data.gender || "";
      document.getElementById("profileBirthday").value = r.data.birthday || "";
      document.getElementById("profilePhone").value = r.data.phone || "";
      document.getElementById("profileBio").value = r.data.bio || "";
      var initial = (r.data.name || r.data.username || "?").charAt(0);
      document.getElementById("profileAvatar").textContent = initial;
    }
  });
  document.getElementById("profileError").textContent = "";
  document.getElementById("profileSuccess").textContent = "";
}

async function saveProfile() {
  var uid = localStorage.getItem("yspx_current_user");
  if (!uid) return;
  var errEl = document.getElementById("profileError");
  var sucEl = document.getElementById("profileSuccess");
  errEl.textContent = "";
  sucEl.textContent = "";

  var name = document.getElementById("profileName").value.trim();
  var gender = document.getElementById("profileGender").value;
  var birthday = document.getElementById("profileBirthday").value;
  var phone = document.getElementById("profilePhone").value.trim();
  var bio = document.getElementById("profileBio").value.trim();

  try {
    var session = JSON.parse(localStorage.getItem("yspx_supabase_session") || "{}");
    var res = await fetch(SUPABASE_URL + "/rest/v1/profiles?id=eq." + uid, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + (session.access_token || ""),
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({ name: name, gender: gender, birthday: birthday, phone: phone, bio: bio })
    });
    if (res.ok) {
      sucEl.textContent = "保存成功！";
      setTimeout(function() { sucEl.textContent = ""; }, 2000);
    } else {
      errEl.textContent = "保存失败，请重试";
    }
  } catch(e) {
    errEl.textContent = "网络错误";
  }
}

async function deleteAccount() {
  if (!confirm("确定要删除账号吗？\n\n此操作不可撤销！\n- 所有学习数据将被清除\n- 云端账号将被删除\n\n确定继续？")) return;
  if (!confirm("再次确认：真的要永久删除账号吗？")) return;

  try {
    var session = JSON.parse(localStorage.getItem("yspx_supabase_session") || "{}");
    if (session.access_token) {
      await fetch(SUPABASE_URL + "/auth/v1/user", {
        method: "DELETE",
        headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + session.access_token }
      });
    }
  } catch(e) {}

  var keys = [];
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (k && k.indexOf("yspx_") === 0) keys.push(k);
  }
  keys.forEach(function(k) { localStorage.removeItem(k); });
  location.reload();
}

async function logout() {
  if (confirm("确定要退出登录吗？")) {
    try {
      var session = JSON.parse(localStorage.getItem("yspx_supabase_session") || "{}");
      if (session.access_token) {
        await fetch(SUPABASE_URL + "/auth/v1/logout", {
          method: "POST",
          headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + session.access_token }
        });
      }
    } catch(e) {}
    localStorage.removeItem("yspx_current_user");
    localStorage.removeItem("yspx_auto_login");
    localStorage.removeItem("yspx_supabase_session");
    location.reload();
  }
}


// Show app (hide auth, show main UI)
function showApp() {
  document.getElementById("page-auth").style.display = "none";
  document.querySelectorAll(".page:not(#page-auth)").forEach(function(p){ p.style.display = ""; });
  document.getElementById("page-home").classList.add("active");
  document.getElementById("page-home").style.display = "";
  document.querySelectorAll(".nav-item")[0].classList.add("active");
  initApp();
}

// ===== OTP Login =====
async function doOtpLogin() {
  var email = document.getElementById("authOtpEmail").value.trim();
  var errEl = document.getElementById("authOtpError");
  var sucEl = document.getElementById("authOtpSuccess");
  errEl.textContent = "";
  sucEl.textContent = "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = "请输入有效的邮箱地址"; btn.disabled = false; btn.textContent = "发送验证码"; return; }

  var btn = document.getElementById("authOtpBtn");
  btn.disabled = true;

  try {
    if (otpStep === "send") {
      btn.innerHTML = '<span class="auth-loading"></span>发送中...';
      var res = await fetch(SUPABASE_URL + "/auth/v1/otp", {
        method: "POST",
        headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, create_user: false })
      });
      if (!res.ok) {
        var data = await res.json();
        errEl.textContent = data.msg || data.message || "发送失败";
        btn.disabled = false;
        btn.textContent = "发送验证码";
        return;
      }
      sucEl.textContent = "验证码已发送到 " + email + "，请查收邮件";
      document.getElementById("authOtpCodeRow").style.display = "block";
      document.getElementById("authOtpEmail").disabled = true;
      btn.textContent = "验证并登录";
      otpStep = "verify";
      btn.disabled = false;
    } else {
      var code = document.getElementById("authOtpCode").value.trim();
      if (!code || code.length !== 6) { errEl.textContent = "请输入6位验证码"; btn.disabled = false; return; }
      btn.innerHTML = '<span class="auth-loading"></span>验证中...';

      var res = await fetch(SUPABASE_URL + "/auth/v1/verify", {
        method: "POST",
        headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, token: code, type: "email" })
      });
      var data = await res.json();
      if (!res.ok) {
        errEl.textContent = data.msg || data.message || "验证码错误或已过期";
        btn.disabled = false;
        btn.textContent = "验证并登录";
        return;
      }

      // Save session
      localStorage.setItem("yspx_supabase_session", JSON.stringify(data));
      localStorage.setItem("yspx_current_user", data.user.id);
      localStorage.setItem("yspx_auto_login", "1");
      showApp();
    }
  } catch(e) {
    errEl.textContent = "网络错误，请检查网络连接后重试";
    btn.disabled = false;
    btn.textContent = otpStep === "send" ? "发送验证码" : "验证并登录";
  }
}

// ===== Forgot Password =====
async function doForgotPassword() {
  var email = document.getElementById("authForgotEmail").value.trim();
  var errEl = document.getElementById("authForgotError");
  var sucEl = document.getElementById("authForgotSuccess");
  errEl.textContent = "";
  sucEl.textContent = "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = "请输入有效的邮箱地址"; return; }

  var btn = document.getElementById("authForgotBtn");
  btn.disabled = true;

  // Check if we're in "set new password" mode (after clicking reset link)
  var newPwdDiv = document.getElementById("authForgotNewPwd");
  if (newPwdDiv.style.display === "block") {
    var pwd = document.getElementById("authForgotPassword").value;
    var pwd2 = document.getElementById("authForgotPassword2").value;
    if (!pwd || pwd.length < 6) { errEl.textContent = "新密码至少6个字符"; btn.disabled = false; return; }
    if (pwd !== pwd2) { errEl.textContent = "两次密码不一致"; btn.disabled = false; return; }

    btn.innerHTML = '<span class="auth-loading"></span>更新中...';
    try {
      var session = supabase.auth._getSession();
      var res = await fetch(SUPABASE_URL + "/auth/v1/user", {
        method: "PUT",
        headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + (session ? session.access_token : ""), "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd })
      });
      if (res.ok) {
        sucEl.textContent = "密码已重置！请返回登录";
        newPwdDiv.style.display = "none";
        btn.textContent = "已完成";
      } else {
        var d = await res.json();
        errEl.textContent = d.msg || "重置失败，请重新发送重置邮件";
      }
    } catch(e) {
      errEl.textContent = "网络错误";
    }
    btn.disabled = false;
    return;
  }

  btn.innerHTML = '<span class="auth-loading"></span>发送中...';
  try {
    var res = await fetch(SUPABASE_URL + "/auth/v1/recover", {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email })
    });
    if (!res.ok) {
      var data = await res.json();
      errEl.textContent = data.msg || data.message || "发送失败";
      btn.disabled = false;
      btn.textContent = "发送重置邮件";
      return;
    }
    sucEl.textContent = "重置邮件已发送到 " + email + "，请查收邮件并点击链接设置新密码";
    btn.textContent = "已发送";
  } catch(e) {
    errEl.textContent = "网络错误，请检查网络连接后重试";
    btn.disabled = false;
    btn.textContent = "发送重置邮件";
  }
}