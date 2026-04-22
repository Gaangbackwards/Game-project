const canvas = document.getElementById('game');
    const box = document.getElementById('gamebox');
    const overlay = document.getElementById('overlay');
    const menu = document.getElementById('menu');
    const startBtn = document.getElementById('start');
    const scoreEl = document.getElementById('score');
    const healthEl = document.getElementById('health');
    const levelEl = document.getElementById('level');
    const powerupStatusEl = document.getElementById('powerup-status');
    const highEl = document.getElementById('high');
    const livesEl = document.getElementById('lives');
    const leaksEl = document.getElementById('leaks');
    const leakLimitDisplay = document.getElementById('leak-limit-display');
    const btnPause = document.getElementById('btn-pause');
    const btnAutofireHUD = document.getElementById('hud-autofire');
    // ✅ FIX: Hapus const btnAutofireMenu global agar tidak stale
    const btnSound = document.getElementById('btn-sound');
    const pauseOverlay = document.getElementById('pause-overlay');
    const pauseResume = document.getElementById('pause-resume');
    const pauseExit = document.getElementById('pause-exit');
    const pauseTitle = document.getElementById('pause-title');
    const joystickArea = document.getElementById('joystick-area');
    const joystickKnob = document.getElementById('joystick-knob');
    const fireBtn = document.getElementById('fire-btn');
    const bombBtn = document.getElementById('bomb-btn');

    const ctx = canvas.getContext('2d');
    let SOUND_ON = true;
    let audioUnlocked = false;
    let selectedDifficulty = null;

    const DIFFICULTY_CONFIG = {
      testers: { lives: 999, leakLimit: 999, dmgMult: 0.4, spawnRate: 0.6, bossHp: 0.5 },
      easy:    { lives: 5,   leakLimit: 10,   dmgMult: 0.7, spawnRate: 0.8, bossHp: 0.8 },
      normal:  { lives: 3,   leakLimit: 8,    dmgMult: 1.0, spawnRate: 1.0, bossHp: 1.0 },
      hard:    { lives: 1,   leakLimit: 5,    dmgMult: 1.3, spawnRate: 1.2, bossHp: 1.3 }
    };

    const LEVEL_CONFIG = {
      1: { duration: 180, enemySpeed: 90, bossHpBase: 120, bossSpeed: 60, bgHue: 200 },
      2: { duration: 180, enemySpeed: 110, bossHpBase: 180, bossSpeed: 70, bgHue: 260 },
      3: { duration: 180, enemySpeed: 130, bossHpBase: 260, bossSpeed: 80, bgHue: 310 },
      4: { duration: 180, enemySpeed: 150, bossHpBase: 380, bossSpeed: 90, bgHue: 10 },
      5: { duration: 180, enemySpeed: 170, bossHpBase: 520, bossSpeed: 100, bgHue: 280 }
    };

    const state = {
      playing: false, paused: false, resumeCountdown: 0,
      score: 0, health: 100, maxHealth: 100,
      level: 1, maxLevel: 5, lives: 3, leaks: 0, leakLimit: 5,
      high: Number(localStorage.getItem('flygaa-high')||0),
      player: { x: 60, y: 300, w: 40, h: 30, speed: 320, bullets: [], shootCooldown: 0, invincibleTime: 0, bombCooldown: 0, bombAvailable: false },
      enemies: [], enemyBullets: [], powerups: [], particles: [],
      timers: { enemy: 0, powerup: 0, bossWarning: 0 },
      powerupActive: { tripleShot: 0, rapidFire: 0, shield: 0, spreadShot: 0 },
      levelTimer: 0, boss: null, bossActive: false, bossDefeated: false, levelProgress: 0,
      isAutoFire: false, lastAutoFireTime: 0, speedMultiplier: 1.0, dmgMult: 1.0
    };

    let stars = [];
    function initStars(){
      stars = [];
      for(let i=0; i<120; i++){
        stars.push({
          x: Math.random() * canvas.width, y: Math.random() * canvas.height,
          size: Math.random() * 2 + 0.5, speed: Math.random() * 0.5 + 0.1, layer: Math.floor(Math.random() * 3)
        });
      }
    }

    highEl.textContent = state.high;
    leakLimitDisplay.textContent = state.leakLimit;

    const sounds = {
      shoot: new Audio('shoot.mp3'), explosion: new Audio('explosion.mp3'), powerup: new Audio('powerup.mp3'),
      bossHit: new Audio('boss_hit.mp3'), bossDefeat: new Audio('boss_defeat.mp3'), bomb: new Audio('bomb.mp3'),
      shield: new Audio('shield.mp3')
    };
    function playSound(name) { if (!SOUND_ON || !audioUnlocked) return; const s = sounds[name]; if(s){s.currentTime=0; s.play().catch(()=>{}); } }

    function resize(){
      const rect = box.getBoundingClientRect();
      canvas.width = rect.width; canvas.height = rect.height;
      if(state.player.y > canvas.height - state.player.h) state.player.y = canvas.height/2 - 15;
      initStars();
    }
    window.addEventListener('resize', resize);

    const keys = {};
    document.addEventListener('keydown', e => {
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
      keys[e.key.toLowerCase()] = true;
      if(e.code === 'Space' && state.playing && !state.paused && state.resumeCountdown<=0) shoot();
      if(e.key.toLowerCase() === 'b' && state.playing && !state.paused) useBomb();
      if(e.key.toLowerCase() === 'p' && state.playing) togglePause();
    });
    document.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

    let joystick = { active: false, x: 0, y: 0, originX: 0, originY: 0 };
    function setupJoystick(){
      const updatePos = (cx,cy) => {
        const dx=cx-joystick.originX, dy=cy-joystick.originY, dist=Math.min(Math.hypot(dx,dy),35), angle=Math.atan2(dy,dx);
        joystick.x=Math.cos(angle)*dist/35; joystick.y=Math.sin(angle)*dist/35;
        joystickKnob.style.transform=`translate(calc(-50% + ${Math.cos(angle)*dist}px), calc(-50% + ${Math.sin(angle)*dist}px))`;
      };
      joystickArea.addEventListener('touchstart', e => { e.preventDefault(); const t=e.touches[0]; const r=joystickArea.getBoundingClientRect(); joystick.originX=r.left+r.width/2; joystick.originY=r.top+r.height/2; joystick.active=true; updatePos(t.clientX, t.clientY); }, {passive:false});
      joystickArea.addEventListener('touchmove', e => { if(!joystick.active) return; e.preventDefault(); updatePos(e.touches[0].clientX, e.touches[0].clientY); }, {passive:false});
      const end = () => { joystick.active=false; joystick.x=0; joystick.y=0; joystickKnob.style.transform='translate(-50%,-50%)'; };
      joystickArea.addEventListener('touchend', end); joystickArea.addEventListener('touchcancel', end);
    }

    let firePressed = false;
    const doFire = () => { if(state.playing && !state.paused && state.resumeCountdown<=0) shoot(); };
    fireBtn.addEventListener('touchstart', e => { e.preventDefault(); firePressed=true; doFire(); });
    fireBtn.addEventListener('touchend', e => { e.preventDefault(); firePressed=false; });
    fireBtn.addEventListener('mousedown', doFire);
    fireBtn.addEventListener('mouseup', () => firePressed=false);
    
    bombBtn.addEventListener('click', () => { if(state.playing && !state.paused) useBomb(); });
    bombBtn.addEventListener('touchstart', e => { e.preventDefault(); if(state.playing && !state.paused) useBomb(); });

    // ✅ FIX: updateUI sekarang query elemen menu secara dinamis
    function updateUI(){
      scoreEl.textContent=state.score; healthEl.textContent=state.health;
      levelEl.textContent=`${state.level}/${state.maxLevel}`; leaksEl.textContent=state.leaks;
      leakLimitDisplay.textContent = state.leakLimit;
      if(selectedDifficulty === 'testers') livesEl.textContent = '∞ UNLIMITED';
      else livesEl.textContent = '❤️'.repeat(Math.max(0, state.lives)) || '💀';
      
      let p=''; if(state.powerupActive.tripleShot>0)p+='🟡Triple '; if(state.powerupActive.rapidFire>0)p+='🔵Rapid ';
      if(state.powerupActive.shield>0)p+='🟣Shield '; if(state.powerupActive.spreadShot>0)p+='🟠Spread ';
      if(state.player.bombAvailable)p+='💣Bomb '; powerupStatusEl.textContent=p;
      
      const afText = '🔁 Auto: ' + (state.isAutoFire ? 'ON' : 'OFF');
      if(btnAutofireHUD) {
        btnAutofireHUD.textContent = afText;
        btnAutofireHUD.classList.toggle('active', state.isAutoFire);
      }
      // Query realtime agar tidak stale setelah innerHTML rebuild
      const currentMenuAuto = document.getElementById('menu-autofire');
      if(currentMenuAuto) {
        currentMenuAuto.textContent = '🔁 Auto Fire: ' + (state.isAutoFire ? 'ON' : 'OFF');
        currentMenuAuto.classList.toggle('active', state.isAutoFire);
      }
    }

    function reset(){
      const cfg = DIFFICULTY_CONFIG[selectedDifficulty];
      state.lives = cfg.lives; state.leakLimit = cfg.leakLimit; state.dmgMult = cfg.dmgMult;
      state.score=0; state.health=100; state.level=1; state.leaks=0; state.levelTimer=0; state.levelProgress=0;
      state.speedMultiplier=1.0; state.paused=false; state.resumeCountdown=0; state.boss=null; state.bossActive=false; state.bossDefeated=false;
      state.player.x=60; state.player.y=canvas.height/2-15; state.player.bullets=[]; state.player.shootCooldown=0; state.player.invincibleTime=0;
      state.player.bombCooldown=0; state.player.bombAvailable=false;
      state.enemies=[]; state.enemyBullets=[]; state.powerups=[]; state.particles=[];
      state.timers={enemy:0,powerup:0,bossWarning:0}; state.powerupActive={tripleShot:0,rapidFire:0,shield:0,spreadShot:0};
      pauseOverlay.classList.remove('visible'); btnPause.disabled=false; btnPause.textContent='⏸️ Pause';
      bombBtn.classList.remove('cooldown');
      updateUI();
    }

    function togglePause(){
      if(state.resumeCountdown > 0) return;
      state.paused = !state.paused;
      pauseOverlay.classList.toggle('visible', state.paused);
      btnPause.textContent = state.paused ? '▶️ Resume' : '⏸️ Pause';
      if(state.paused){
        state.resumeCountdown = 3;
        pauseTitle.textContent = '⏸️ PAUSED';
      }
    }
    btnPause.addEventListener('click', togglePause);
    pauseResume.addEventListener('click', togglePause);
    pauseExit.addEventListener('click', () => { state.playing=false; state.paused=false; pauseOverlay.classList.remove('visible'); overlay.classList.remove('hidden'); initMenuEvents(); });

    function toggleAutoFire(){
      state.isAutoFire = !state.isAutoFire;
      updateUI();
    }
    btnAutofireHUD.addEventListener('click', toggleAutoFire);
    btnSound.addEventListener('click', ()=>{ SOUND_ON=!SOUND_ON; btnSound.textContent='🔊 Sound: '+(SOUND_ON?'ON':'OFF'); });

    function shoot(){
      if(state.player.shootCooldown>0) return;
      const cd = state.powerupActive.rapidFire>0 ? 0.08 : 0.18; state.player.shootCooldown=cd;
      const spd=650, sx=state.player.x+state.player.w, cy=state.player.y+state.player.h/2;
      if(state.powerupActive.spreadShot>0){
        for(let a of [-0.3,-0.15,0,0.15,0.3]) state.player.bullets.push({x:sx,y:cy,w:10,h:4,speed:spd,vx:Math.cos(a),vy:Math.sin(a)});
      } else if(state.powerupActive.tripleShot>0){
        state.player.bullets.push({x:sx,y:cy,w:8,h:4,speed:spd,vx:1,vy:0});
        state.player.bullets.push({x:sx,y:cy-15,w:8,h:4,speed:spd,vx:1,vy:-0.2});
        state.player.bullets.push({x:sx,y:cy+15,w:8,h:4,speed:spd,vx:1,vy:0.2});
      } else {
        state.player.bullets.push({x:sx,y:cy,w:8,h:4,speed:spd,vx:1,vy:0});
      }
      playSound('shoot');
    }

    function useBomb(){
      if(!state.playing || state.paused || state.player.bombCooldown>0 || !state.player.bombAvailable) return;
      state.player.bombAvailable=false; state.player.bombCooldown=15; bombBtn.classList.add('cooldown');
      for(let i=state.enemies.length-1;i>=0;i--){
        const e=state.enemies[i]; if(Math.hypot(e.x-state.player.x,e.y-state.player.y)<300){
          createParticles(e.x+e.w/2,e.y+e.h/2,'#ffd700',12); state.score+=e.type==='big'?30:10; state.enemies.splice(i,1);
        }
      }
      if(state.bossActive && state.boss){
        if(Math.hypot(state.boss.x-state.player.x,state.boss.y-state.player.y)<400){
          state.boss.health-=30; createParticles(state.boss.x+state.boss.w/2,state.boss.y+state.boss.h/2,'#ff6b6b',20); playSound('bossHit');
        }
      }
      state.particles.push({x:state.player.x+state.player.w/2,y:state.player.y+state.player.h/2,vx:0,vy:0,life:0.4,maxLife:0.4,color:'#ffd700',isBomb:true,radius:0,maxRadius:300});
      playSound('bomb'); updateUI();
    }

    function spawnEnemy(){
      if(state.bossActive) return;
      const cfg=LEVEL_CONFIG[state.level]; const y=Math.random()*(canvas.height-70)+10;
      const types=['normal','fast','big']; const type=types[Math.floor(Math.random()*(state.level>=3?3:2))];
      let e={x:canvas.width+20,y,type,health:1};
      switch(type){
        case 'normal': e.w=32;e.h=32; e.speed=(cfg.enemySpeed+state.level*10)*state.speedMultiplier; e.color='#ff4444'; e.points=10; break;
        case 'fast': e.w=24;e.h=24; e.speed=(cfg.enemySpeed*1.4+state.level*12)*state.speedMultiplier; e.color='#ff8844'; e.points=20; break;
        case 'big': e.w=52;e.h=42; e.speed=(cfg.enemySpeed*0.7+state.level*5)*state.speedMultiplier; e.health=3; e.color='#aa4444'; e.points=30; break;
      }
      state.enemies.push(e);
    }

    function spawnBoss(){
      const cfg=LEVEL_CONFIG[state.level]; const diff=DIFFICULTY_CONFIG[selectedDifficulty];
      state.boss={x:canvas.width-120,y:canvas.height/2-40,w:80,h:80,health:cfg.bossHpBase*diff.bossHp,maxHealth:cfg.bossHpBase*diff.bossHp,speed:cfg.bossSpeed,
                  color:state.level===5?'#9b59b6':'#e74c3c',shootTimer:0,pattern:state.level>=3?'spread':'single',phase:1};
      state.bossActive=true; state.bossDefeated=false; state.enemies=[]; state.enemyBullets=[];
    }

    function spawnPowerup(){
      if(state.bossActive) return;
      const types=['tripleShot','rapidFire','health','shield','spreadShot','bomb'];
      const weights=[2,2,2,1,1.5,1]; let rand=Math.random()*weights.reduce((a,b)=>a+b,0), cum=0, type=types[0];
      for(let i=0;i<types.length;i++){ cum+=weights[i]; if(rand<cum){type=types[i];break;} }
      state.powerups.push({x:canvas.width+10,y:Math.random()*(canvas.height-40)+20,w:24,h:24,type,bobOffset:Math.random()*Math.PI*2,
                           color:{tripleShot:'#ffdd44',rapidFire:'#4488ff',health:'#44ff88',shield:'#aa44ff',spreadShot:'#ff8844',bomb:'#ffd700'}[type]});
    }

    function createParticles(x,y,color,count=6){
      for(let i=0;i<count;i++) state.particles.push({x,y,vx:(Math.random()-0.5)*250,vy:(Math.random()-0.5)*250,life:0.4+Math.random()*0.3,maxLife:0.7,color,size:2+Math.random()*3});
    }

    function checkCollision(a,b){ return a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y; }

    function updateLevelProgress(dt){
      state.levelTimer += dt;
      const cfg = LEVEL_CONFIG[state.level];
      state.levelProgress = Math.min(100, (state.levelTimer / cfg.duration) * 100);
      state.speedMultiplier = 1.0 + (state.levelProgress / 100) * 0.25;
      if(state.levelProgress >= 98 && !state.bossActive && !state.bossDefeated){
        if(state.timers.bossWarning<=0) state.timers.bossWarning=3;
        else { state.timers.bossWarning-=dt; if(state.timers.bossWarning<=0) spawnBoss(); }
      }
    }

    function updateBoss(dt){
      if(!state.bossActive || !state.boss) return;
      const b=state.boss;
      b.y+=Math.sin(state.levelTimer*2)*b.speed*0.3*dt;
      const targetY=state.player.y+state.player.h/2-b.h/2;
      b.y+=Math.sign(targetY-b.y)*Math.min(Math.abs(targetY-b.y),b.speed*0.2*dt);
      b.y=Math.max(10,Math.min(canvas.height-b.h-10,b.y));
      b.shootTimer-=dt;
      const interval=b.phase===1?1.2:0.7;
      if(b.shootTimer<=0){
        b.shootTimer=interval;
        const baseAngle=Math.atan2(state.player.y+state.player.h/2-(b.y+b.h/2), state.player.x-b.x);
        if(b.pattern==='single'){
          state.enemyBullets.push({x:b.x-10,y:b.y+b.h/2,w:10,h:10,vx:Math.cos(baseAngle)*280,vy:Math.sin(baseAngle)*280,color:'#ff6b6b'});
        } else {
          for(let i=-2;i<=2;i++){ if(i===0)continue; const a=baseAngle+i*0.25; state.enemyBullets.push({x:b.x-10,y:b.y+b.h/2,w:9,h:9,vx:Math.cos(a)*260,vy:Math.sin(a)*260,color:'#ff8844'}); }
          if(state.level===5 && b.phase===2){
            for(let i=-3;i<=3;i++){ const a=baseAngle+i*0.18; state.enemyBullets.push({x:b.x-10,y:b.y+b.h/2,w:8,h:8,vx:Math.cos(a)*300,vy:Math.sin(a)*300,color:'#9b59b6'}); }
          }
        }
      }
      if(b.health<b.maxHealth*0.5 && b.phase===1){
        b.phase=2; b.pattern='spread'; b.speed*=1.2; createParticles(b.x+b.w/2,b.y+b.h/2,'#ffd700',30);
      }
    }

    function handleDamage(amount){
      if(state.powerupActive.shield > 0) {
        playSound('shield');
        createParticles(state.player.x+state.player.w/2, state.player.y+state.player.h/2, '#4fd1c5', 5);
        return;
      }
      if(state.player.invincibleTime > 0) return;
      
      state.health -= amount * state.dmgMult;
      state.player.invincibleTime = 1.2;
      
      if(state.health <= 0){
        if(selectedDifficulty === 'testers' || state.lives > 1){
          if(selectedDifficulty !== 'testers') state.lives--;
          state.health = 100;
          state.player.invincibleTime = 2.5;
          state.player.x = 60; state.player.y = canvas.height/2-15;
          state.enemies = state.enemies.filter(e => e.x < canvas.width/2);
          state.enemyBullets = state.enemyBullets.filter(eb => eb.x < canvas.width/2);
          playSound('explosion');
        } else {
          endGame('defeat');
        }
      }
    }

    function update(dt){
      if(!state.playing) return;

      if(state.paused && state.resumeCountdown > 0){
        state.resumeCountdown -= dt;
        if(state.resumeCountdown <= 0) { state.paused = false; pauseOverlay.classList.remove('visible'); lastTime = performance.now(); }
        return;
      }

      if(state.player.shootCooldown>0) state.player.shootCooldown-=dt;
      if(state.player.bombCooldown>0){ state.player.bombCooldown-=dt; if(state.player.bombCooldown<=0){state.player.bombAvailable=true;bombBtn.classList.remove('cooldown');} }
      if(state.player.invincibleTime > 0) state.player.invincibleTime -= dt;
      
      for(let k in state.powerupActive) if(state.powerupActive[k]>0) state.powerupActive[k]-=dt;
      updateUI();

      if(state.isAutoFire){ state.lastAutoFireTime+=dt; const i=state.powerupActive.rapidFire>0?0.08:0.22; if(state.lastAutoFireTime>=i){shoot();state.lastAutoFireTime=0;} }
      if(firePressed && !state.isAutoFire) shoot();

      const mx=(keys['a']||keys['arrowleft']?-1:0)+(keys['d']||keys['arrowright']?1:0)+joystick.x;
      const my=(keys['w']||keys['arrowup']?-1:0)+(keys['s']||keys['arrowdown']?1:0)+joystick.y;
      const m=8;
      state.player.x=Math.max(m,Math.min(canvas.width-state.player.w-m,state.player.x+mx*state.player.speed*dt));
      state.player.y=Math.max(m,Math.min(canvas.height-state.player.h-m,state.player.y+my*state.player.speed*dt));

      for(let i=state.player.bullets.length-1;i>=0;i--){ const b=state.player.bullets[i]; b.x+=b.speed*b.vx*dt; b.y+=b.speed*b.vy*dt; if(b.x>canvas.width+20||b.x<-20||b.y<-20||b.y>canvas.height+20) state.player.bullets.splice(i,1); }
      for(let i=state.enemyBullets.length-1;i>=0;i--){ const eb=state.enemyBullets[i]; eb.x+=eb.vx*dt; eb.y+=eb.vy*dt;
        if(checkCollision(eb,state.player)){ handleDamage(10); state.enemyBullets.splice(i,1); continue; }
        if(eb.x<-20||eb.x>canvas.width+20||eb.y<-20||eb.y>canvas.height+20) state.enemyBullets.splice(i,1); }

      for(let i=state.particles.length-1;i>=0;i--){ const p=state.particles[i]; if(p.isBomb){ p.radius=(1-p.life/p.maxLife)*p.maxRadius; p.life-=dt; if(p.life<=0)state.particles.splice(i,1); continue; } p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt; if(p.life<=0)state.particles.splice(i,1); }

      if(!state.bossActive){ const cfg=LEVEL_CONFIG[state.level]; state.timers.enemy+=dt; const diff=DIFFICULTY_CONFIG[selectedDifficulty]; const sr=Math.max(1.4 - state.level*0.1, 0.5) / (state.speedMultiplier * diff.spawnRate); if(state.timers.enemy>sr){spawnEnemy();state.timers.enemy=0;} }
      state.timers.powerup+=dt; if(state.timers.powerup>12 && !state.bossActive){spawnPowerup();state.timers.powerup=0;}
      if(!state.bossDefeated) updateLevelProgress(dt);
      if(state.bossActive) updateBoss(dt);

      for(let i=state.enemies.length-1;i>=0;i--){ const e=state.enemies[i]; e.x-=e.speed*dt;
        if(e.x+e.w<0){ 
          state.leaks++;
          if(state.leaks >= state.leakLimit){
            endGame('leak');
            return;
          }
          createParticles(e.x,e.y+e.h/2,'#ff4444',4);
          state.enemies.splice(i,1); 
          updateUI(); 
          continue; 
        }
        
        if(checkCollision(state.player,e)){
          handleDamage(e.type==='fast'?10 : e.type==='big'?20 : 15);
          state.enemies.splice(i,1); updateUI(); continue; 
        }

        for(let j=state.player.bullets.length-1;j>=0;j--){ const b=state.player.bullets[j]; if(checkCollision(b,e)){ state.player.bullets.splice(j,1); e.health--;
          if(e.health<=0){ createParticles(e.x+e.w/2,e.y+e.h/2,e.color,8); state.score+=Math.floor(e.points*state.speedMultiplier); if(state.score>state.high){state.high=state.score;localStorage.setItem('flygaa-high',state.high);highEl.textContent=state.high;} state.enemies.splice(i,1); updateUI(); playSound('explosion'); } break; } }
      }

      if(state.bossActive && state.boss){
        for(let j=state.player.bullets.length-1;j>=0;j--){ const b=state.player.bullets[j]; if(checkCollision(b,state.boss)){ state.player.bullets.splice(j,1); state.boss.health-=state.powerupActive.spreadShot>0?2:1; createParticles(b.x,b.y,'#ffd700',3);
          if(state.boss.health<=0){ state.bossDefeated=true; state.bossActive=false; createParticles(state.boss.x+state.boss.w/2,state.boss.y+state.boss.h/2,'#ffd700',40); playSound('bossDefeat'); state.score+=500*state.level;
            if(state.level>=state.maxLevel){ endGame('victory'); return; } else { 
              state.level++; state.levelTimer=0; state.levelProgress=0; state.speedMultiplier=1.0; 
              state.boss=null; state.bossActive=false; state.bossDefeated=false;
              updateUI(); 
            }
          } break; } }
      }

      for(let i=state.powerups.length-1;i>=0;i--){ const p=state.powerups[i]; p.x-=90*state.speedMultiplier*dt; p.bobOffset+=dt*4; if(p.x+p.w<0){state.powerups.splice(i,1);continue;}
        if(checkCollision(state.player,p)){ createParticles(p.x+p.w/2,p.y+p.h/2,p.color,10);
          switch(p.type){ case 'tripleShot':state.powerupActive.tripleShot=12;break; case 'rapidFire':state.powerupActive.rapidFire=10;break; case 'health':state.health=Math.min(state.health+35,state.maxHealth);break; case 'shield':state.powerupActive.shield=8;break; case 'spreadShot':state.powerupActive.spreadShot=15;break; case 'bomb':state.player.bombAvailable=true;bombBtn.classList.remove('cooldown');break; }
          state.powerups.splice(i,1); playSound('powerup'); updateUI(); } }
    }

    function drawGalaxy(){
      const cfg = LEVEL_CONFIG[state.level] || LEVEL_CONFIG[1];
      const hueShift = (state.levelTimer * 5) % 60;
      const h = cfg.bgHue + hueShift;
      const g = ctx.createLinearGradient(0,0,0,canvas.height);
      g.addColorStop(0, `hsl(${h}, 60%, 8%)`);
      g.addColorStop(1, `hsl(${(h+40)%360}, 50%, 3%)`);
      ctx.fillStyle = g; ctx.fillRect(0,0,canvas.width,canvas.height);

      ctx.fillStyle = '#fff';
      for(const s of stars){
        s.x -= s.speed * s.layer * 0.3;
        if(s.x < 0) s.x = canvas.width;
        ctx.globalAlpha = 0.3 + s.layer * 0.2;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      const px = canvas.width * 0.75, py = canvas.height * 0.3, pr = 80 + state.level * 15;
      const pg = ctx.createRadialGradient(px, py, 0, px, py, pr);
      pg.addColorStop(0, `hsla(${h+20}, 80%, 60%, 0.4)`);
      pg.addColorStop(0.6, `hsla(${h+40}, 70%, 40%, 0.2)`);
      pg.addColorStop(1, 'transparent');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = `hsla(${h+90}, 90%, 70%, 0.3)`;
      ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(px, py, pr*1.4, pr*0.3, Math.PI/6, 0, Math.PI*2); ctx.stroke();
    }

    function render(){
      drawGalaxy();
      if(state.paused && state.resumeCountdown > 0){
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = '#4fd1c5'; ctx.font = 'bold 60px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(Math.ceil(state.resumeCountdown), canvas.width/2, canvas.height/2 + 20);
        ctx.font = '20px sans-serif'; ctx.fillStyle = '#fff';
        ctx.fillText('BERSIAP...', canvas.width/2, canvas.height/2 - 20);
      }

      if(!state.bossActive && !state.bossDefeated && state.playing){ 
        ctx.fillStyle='rgba(255,255,255,0.1)'; ctx.fillRect(canvas.width/2-100,8,200,6); ctx.fillStyle=state.levelProgress>90?'#ff6b6b':'#4fd1c5'; ctx.fillRect(canvas.width/2-100,8,200*state.levelProgress/100,6); if(state.timers.bossWarning>0){ ctx.fillStyle='#ffd700'; ctx.font='bold 14px sans-serif'; ctx.textAlign='center'; ctx.fillText(`⚠️ BOSS INCOMING! ${Math.ceil(state.timers.bossWarning)}s`, canvas.width/2, 30); } 
      }
      
      if(state.player.invincibleTime>0 && Math.floor(state.player.invincibleTime*8)%2===0) ctx.globalAlpha=0.4;
      if(state.powerupActive.shield>0){ ctx.strokeStyle='#4fd1c5'; ctx.lineWidth=3; ctx.globalAlpha*=0.7+Math.sin(state.levelTimer*8)*0.3; ctx.beginPath(); ctx.arc(state.player.x+state.player.w/2,state.player.y+state.player.h/2,32,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1; }
      ctx.fillStyle='#4fd1c5'; ctx.fillRect(state.player.x,state.player.y,state.player.w,state.player.h);
      ctx.fillStyle='#7c3aed'; ctx.beginPath(); ctx.moveTo(state.player.x+state.player.w,state.player.y+5); ctx.lineTo(state.player.x+state.player.w+12,state.player.y+state.player.h/2); ctx.lineTo(state.player.x+state.player.w,state.player.y+state.player.h-5); ctx.fill();
      ctx.globalAlpha=1;

      for(const b of state.player.bullets){ ctx.fillStyle=b.vx!==1?'#ff8844':'#ffff44'; ctx.fillRect(b.x,b.y-b.h/2,b.w,b.h); ctx.fillStyle='rgba(255,255,100,0.3)'; ctx.fillRect(b.x-15,b.y-b.h/2+1,15,b.h-2); }
      for(const eb of state.enemyBullets){ ctx.fillStyle=eb.color; ctx.beginPath(); ctx.arc(eb.x,eb.y,eb.w/2,0,Math.PI*2); ctx.fill(); ctx.fillStyle='rgba(255,100,100,0.4)'; ctx.beginPath(); ctx.arc(eb.x-eb.vx*0.03,eb.y-eb.vy*0.03,eb.w/2+3,0,Math.PI*2); ctx.fill(); }
      for(const e of state.enemies){ ctx.fillStyle=e.color; ctx.fillRect(e.x,e.y,e.w,e.h); ctx.fillStyle='#111'; ctx.fillRect(e.x+6,e.y+8,6,6); ctx.fillRect(e.x+e.w-12,e.y+8,6,6); if(e.type==='big'&&e.health<3){ ctx.fillStyle='#333'; ctx.fillRect(e.x,e.y-10,e.w,5); ctx.fillStyle='#4fd1c5'; ctx.fillRect(e.x,e.y-10,e.w*(e.health/3),5); } }
      
      if(state.bossActive && state.boss){ const b=state.boss; ctx.fillStyle=b.color; ctx.fillRect(b.x,b.y,b.w,b.h); ctx.fillStyle='#1a1a2e'; ctx.fillRect(b.x+10,b.y+15,b.w-20,b.h-30); ctx.fillStyle='#ff6b6b'; ctx.beginPath(); ctx.arc(b.x+b.w/2,b.y+b.h/2,12,0,Math.PI*2); ctx.fill();
        const bw=120,bh=8,bx=canvas.width/2-bw/2,by=15; ctx.fillStyle='#333'; ctx.fillRect(bx,by,bw,bh); ctx.fillStyle=b.phase===2?'#ffd700':'#4fd1c5'; ctx.fillRect(bx,by,bw*(b.health/b.maxHealth),bh); ctx.fillStyle='white'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center'; ctx.fillText(`BOSS LVL ${state.level} • HP: ${Math.ceil(b.health)}/${Math.ceil(b.maxHealth)}`, canvas.width/2, by+20);
        if(b.health<b.maxHealth*0.3){ ctx.strokeStyle='#ff6b6b'; ctx.lineWidth=2+Math.sin(state.levelTimer*10); ctx.strokeRect(b.x-3,b.y-3,b.w+6,b.h+6); } }

      for(const p of state.powerups){ const by=p.y+Math.sin(p.bobOffset)*4; ctx.shadowColor=p.color; ctx.shadowBlur=12; ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x+p.w/2,by+p.h/2,p.w/2,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0; ctx.fillStyle='#111'; ctx.font='bold 14px sans-serif'; ctx.textAlign='center'; ctx.fillText({tripleShot:'✦',rapidFire:'⚡',health:'♥',shield:'◈',spreadShot:'✹',bomb:'💣'}[p.type],p.x+p.w/2,by+p.h/2+5); }
      for(const p of state.particles){ const a=p.life/p.maxLife; if(p.isBomb){ ctx.strokeStyle=`rgba(255,215,0,${a})`; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(p.x,p.y,p.radius,0,Math.PI*2); ctx.stroke(); } else { ctx.fillStyle=p.color+Math.floor(a*255).toString(16).padStart(2,'0'); ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size); } }
    }

    let lastTime=0;
    function gameLoop(t){ if(!lastTime)lastTime=t; const dt=Math.min((t-lastTime)/1000,1/30); lastTime=t; update(dt); render(); requestAnimationFrame(gameLoop); }

    function startGame(){ 
      audioUnlocked=true; 
      overlay.classList.add('hidden'); 
      state.playing=true; 
      reset(); 
      setupJoystick(); 
    }
    
    function endGame(reason){ 
      state.playing = false; 
      state.paused = false; 
      pauseOverlay.classList.remove('visible'); 
      btnPause.disabled = true;
      overlay.classList.remove('hidden');

      let html = '';
      if(reason === 'victory') html = `<h1>🎊 SELAMAT! 🎊</h1><p style="font-size:16px;margin:15px 0;line-height:1.6">Selamat kamu telah mengalahkan bos <span class="highlight">Episode 1</span><br>Mode: <strong>${selectedDifficulty.charAt(0).toUpperCase()+selectedDifficulty.slice(1)}</strong><br><br>Final Score: <strong>${state.score}</strong><br>Terima kasih telah berdedikasi untuk menyelesaikan game ini<br>🎮 Tunggu update selanjutnya dari developer! 🎮</p>`;
      else if(reason === 'leak') html = `<h1>💥 Game Over</h1><p><strong>Terlalu banyak musuh lolos!</strong><br>Leaks: ${state.leaks}/${state.leakLimit}</p><p>Score: ${state.score} • Level: ${state.level}</p>`;
      else html = `<h1>💥 Game Over</h1><p><strong>Nyawa Habis!</strong></p><p>Score: ${state.score} • Level: ${state.level}</p>`;
      
      html += `<button id="restart" class="primary">🔄 Kembali ke Menu</button>`;
      menu.innerHTML = html;

      setTimeout(() => {
        const restartBtn = document.getElementById('restart');
        if(restartBtn) {
          restartBtn.onclick = () => {
            menu.innerHTML = `<h1>🚀 FlyGaa Shooter</h1><p>Episode 1 • Kalahkan 5 Boss dalam 15 menit!<br><span class="highlight">Kontrol:</span> 🖥️ WASD + SPACE • 📱 Analog + FIRE<br>Pilih tingkat kesulitan (Wajib):</p><div class="diff-btns"><button class="diff-btn" data-diff="testers">🔓 Testers (∞)</button><button class="diff-btn" data-diff="easy">🌱 Easy (Leak:10)</button><button class="diff-btn selected" data-diff="normal">⚖️ Normal (Leak:8)</button><button class="diff-btn" data-diff="hard">🔥 Hard (Leak:5)</button></div><button id="menu-autofire" class="menu-btn">🔁 Auto Fire: OFF</button><button id="start" class="primary" disabled>🎮 MULAI GAME</button>`;
            selectedDifficulty = null;
            state.isAutoFire = false;
            initMenuEvents();
          };
        }
      }, 50);
    }

    function initMenuEvents(){
      document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.onclick = () => {
          document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          selectedDifficulty = btn.dataset.diff;
          document.getElementById('start').disabled = false;
        };
      });

      const menuAutoBtn = document.getElementById('menu-autofire');
      if(menuAutoBtn){
        menuAutoBtn.onclick = () => toggleAutoFire();
        // Set text awal saat menu dirender
        menuAutoBtn.textContent = '🔁 Auto Fire: ' + (state.isAutoFire ? 'ON' : 'OFF');
        menuAutoBtn.classList.toggle('active', state.isAutoFire);
      }

      document.getElementById('start').onclick = startGame;
    }
    
    initMenuEvents();
    resize();
    requestAnimationFrame(gameLoop);