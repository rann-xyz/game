import * as THREE from 'three'

// Procedural low-poly soldier: body + head + legs + arms + weapon
// Team colors: player = blue, enemy = red
// Returns a Group ready for animation via userData

const TEAM = {
  player: { body: 0x2a5a9a, armor: 0x3a7ad8, skin: 0xd8b8a0, emissive: 0x102040 },
  enemy:  { body: 0x8a2a1a, armor: 0xc83a2a, skin: 0xd8b8a0, emissive: 0x301010 },
}

export function createSoldierMesh(type: string, team: 'player'|'enemy'): THREE.Group {
  const col = TEAM[team]
  const g = new THREE.Group()
  const matBody = new THREE.MeshStandardMaterial({ color: col.body, roughness: 0.7, metalness: 0.1 })
  const matArmor = new THREE.MeshStandardMaterial({ color: col.armor, roughness: 0.4, metalness: 0.3 })
  const matSkin = new THREE.MeshStandardMaterial({ color: col.skin, roughness: 0.8, metalness: 0 })
  const isHeavy = type === 'heavy' || type === 'heavyCav' || type === 'heavy'
  const isCav = type === 'lightCav' || type === 'heavyCav'
  const isArcher = type === 'archer' || type === 'crossbow'
  const isScout = type === 'scout'

  // horse for cav
  if (isCav) {
    const horse = new THREE.Group()
    const matHorse = new THREE.MeshStandardMaterial({ color: team === 'player' ? 0x5a3a18 : 0x3a2a12, roughness: 0.8 })
    const matHorse2 = new THREE.MeshStandardMaterial({ color: team === 'player' ? 0x7a5a2a : 0x4a3a1a, roughness: 0.7 })
    // body
    const hBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.1, 4, 8), matHorse); hBody.rotation.z = Math.PI/2; hBody.position.set(0, 0.55, 0)
    // neck + head
    const hNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.5, 6), matHorse2); hNeck.rotation.z = -0.6; hNeck.position.set(0.55, 0.85, 0)
    const hHead = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.22), matHorse2); hHead.position.set(0.78, 0.98, 0)
    // legs
    for (const z of [-0.32, 0.32]) for (const x of [-0.35, 0.35]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.55, 5), matHorse); leg.position.set(x, 0.15, z)
      horse.add(leg)
    }
    // tail
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 0.45, 5), matHorse2); tail.rotation.z = 0.5; tail.position.set(-0.62, 0.6, 0)
    horse.add(hBody, hNeck, hHead, tail)
    horse.name = 'horse'
    g.add(horse)
    // rider offset on horse
    const rider = new THREE.Group(); rider.position.set(0, 0.95, 0)
    // rider body
    const rBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.28, 4, 8), isHeavy ? matArmor : matBody); rBody.position.y = 0.22; rider.add(rBody)
    const rHead = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), matSkin); rHead.position.y = 0.55; rider.add(rHead)
    if (isHeavy) { const helm = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8, 0, Math.PI*2, 0, Math.PI*0.6), matArmor); helm.position.y = 0.56; rider.add(helm) }
    // arms + weapon
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.28, 5), matSkin); armL.position.set(-0.18, 0.28, 0); armL.rotation.z = -0.3
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.28, 5), matSkin); armR.position.set(0.18, 0.28, 0); armR.rotation.z = 0.9
    rider.add(armL, armR)
    const lance = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 5), new THREE.MeshStandardMaterial({ color: 0x8a6a3a })); lance.position.set(0.18, 0.35, 0.1); lance.rotation.z = 1.2
    lance.name = 'weapon'; rider.add(lance)
    horse.add(rider)
    ;(rider as any)._armR = armR; (rider as any)._weapon = lance
    g.userData = { horse, rider, armR, weapon: lance, type, team }
    g.castShadow = true; g.traverse(o=>{ (o as THREE.Mesh).castShadow = true; (o as THREE.Mesh).receiveShadow = true })
    return g
  }

  // INFANTRY / RANGED / WORKER
  // body
  const bodyH = isHeavy ? 0.72 : 0.62
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(isHeavy ? 0.22 : 0.18, bodyH, 4, 10), isHeavy ? matArmor : matBody)
  body.position.y = 0.55 + (isHeavy?0.05:0)
  body.castShadow = true
  g.add(body)

  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), matSkin); head.position.y = 0.55 + bodyH/2 + 0.16 + 0.08; head.castShadow = true
  g.add(head)
  if (isHeavy || type === 'swordsman') {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10, 0, Math.PI*2, 0, Math.PI*0.65), matArmor); helm.position.copy(head.position); helm.position.y += 0.02
    g.add(helm)
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.08), new THREE.MeshStandardMaterial({ color: 0xc0c0c0 })); crest.position.copy(head.position); crest.position.y += 0.14
    g.add(crest)
  }
  if (isScout) {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 8, 0, Math.PI*2, 0, Math.PI*0.7), new THREE.MeshStandardMaterial({ color: 0x2a4a2a })); hood.position.copy(head.position); hood.position.y -= 0.02; g.add(hood)
  }

  // legs
  const legGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.42, 6)
  const legL = new THREE.Mesh(legGeo, matBody); legL.position.set(-0.11, 0.22, 0)
  const legR = new THREE.Mesh(legGeo, matBody); legR.position.set(0.11, 0.22, 0)
  legL.name = 'legL'; legR.name = 'legR'
  g.add(legL, legR)

  // arms
  const armGeo = new THREE.CylinderGeometry(0.055, 0.05, 0.32, 6)
  const armL = new THREE.Mesh(armGeo, matSkin); armL.position.set(-0.22, 0.62, 0); armL.rotation.z = -0.2
  const armR = new THREE.Mesh(armGeo, matSkin); armR.position.set(0.22, 0.62, 0); armR.rotation.z = 0.2
  armL.name = 'armL'; armR.name = 'armR'
  g.add(armL, armR)

  // weapon
  let weapon: THREE.Object3D | null = null
  if (type === 'worker') {
    weapon = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 5), new THREE.MeshStandardMaterial({ color: 0x8a6a3a })); weapon.position.set(0.28, 0.55, 0); (weapon as THREE.Mesh).rotation.z = 0.4; weapon.name='weapon'
  } else if (type === 'swordsman' || type === 'heavy') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, 0.015), new THREE.MeshStandardMaterial({ color: 0xd0d8e0, metalness: 0.7, roughness: 0.2 })); blade.position.y = 0.18
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 5), new THREE.MeshStandardMaterial({ color: 0x3a2a1a })); hilt.position.y = -0.12
    const gW = new THREE.Group(); gW.add(blade, hilt); gW.position.set(0.32, 0.55, 0.08); gW.rotation.z = -0.2; gW.name='weapon'; weapon=gW
  } else if (type === 'spearman') {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 5), new THREE.MeshStandardMaterial({ color: 0x6a4a2a })); shaft.position.y = 0.1
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 6), new THREE.MeshStandardMaterial({ color: 0xc0d0e0, metalness: 0.6 })); tip.position.y = 0.7
    const gW = new THREE.Group(); gW.add(shaft,tip); gW.position.set(0.3, 0.7, 0); gW.rotation.z = -0.15; gW.name='weapon'; weapon=gW
  } else if (isArcher) {
    // bow
    const bowCurve = new THREE.TorusGeometry(0.22, 0.015, 6, 12, Math.PI); const bow = new THREE.Mesh(bowCurve, new THREE.MeshStandardMaterial({ color: 0x6a4a2a })); bow.rotation.z = Math.PI/2; bow.position.set(0,0,0)
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.004,0.004,0.44,3), new THREE.MeshStandardMaterial({ color: 0xe8e0c0 })); str.position.set(-0.18,0,0); str.rotation.z = Math.PI/2
    const gW = new THREE.Group(); gW.add(bow,str); gW.position.set(0.14, 0.62, 0.12); gW.rotation.y = 0.25; gW.name='weapon'; weapon=gW
  } else if (type === 'crossbow') {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.04, 0.04), new THREE.MeshStandardMaterial({ color: 0x5a3a2a })); stock.position.set(0,0,0)
    const prod = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.28), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.5 })); prod.position.set(0.12,0.03,0)
    const gW = new THREE.Group(); gW.add(stock,prod); gW.position.set(0.22,0.62,0); gW.name='weapon'; weapon=gW
  }
  if (weapon) g.add(weapon)

  // shield for swordsman/spearman/heavy
  if (type === 'swordsman' || type === 'spearman' || type === 'heavy') {
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 12, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: team==='player'?0x2a4a9a:0x8a2a1a, roughness: 0.5 })); sh.rotation.y = Math.PI/2; sh.rotation.z = Math.PI/2; sh.position.set(-0.28, 0.58, 0.05); sh.scale.set(1,1.2,1); g.add(sh)
  }

  g.userData = { legL, legR, armL, armR, weapon, body, head, type, team, walkT: Math.random()*Math.PI*2 }
  g.traverse(o=>{ (o as THREE.Mesh).castShadow = true; (o as THREE.Mesh).receiveShadow = true })
  return g
}

export function updateSoldierAnim(g: THREE.Group, dt: number, state: string, speed: number, isMoving: boolean, attackT?: number){
  const u = g.userData as any
  const t = performance.now()*0.001
  if (!isMoving) {
    // idle breathing
    g.position.y = Math.sin(t*1.2 + (u.walkT||0))*0.015
    if (u.legL) { u.legL.rotation.x *= 0.9; u.legR.rotation.x *= 0.9 }
    if (u.armL) u.armL.rotation.x *= 0.9
  } else {
    const s = Math.min(1, speed/90)
    const f = 7 * (0.7 + s*0.6)
    const ph = t*f + (u.walkT||0)
    const swing = Math.sin(ph)*0.65
    const swing2 = Math.sin(ph + Math.PI)*0.65
    if (u.legL) u.legL.rotation.x = swing
    if (u.legR) u.legR.rotation.x = swing2
    if (u.armL) u.armL.rotation.x = swing2*0.5
    if (u.armR) {
      // attack overrides
      if (state === 'attacking' && attackT !== undefined) {
        // leave to attack anim
      } else {
        u.armR.rotation.x = swing*0.5
      }
    }
    g.position.y = Math.abs(Math.sin(ph))*0.05
    // horse gait
    if (u.horse) {
      const horse = u.horse as THREE.Group
      horse.position.y = Math.abs(Math.sin(ph*1.1))*0.04
      // legs are part of horse group - wobble handled via horse's own children if we had skeletal
    }
  }
  // attack swing
  if (state === 'attacking' && u.weapon && u.armR) {
    const aT = attackT ?? ((Math.sin(t*5)+1)/2)
    // swing forward: 0..1
    const p = aT // 0..1 provided externally
    const swing = Math.sin(p*Math.PI) // 0→1→0
    u.armR.rotation.x = -0.6 - swing*1.4
    if (u.weapon) {
      u.weapon.rotation.x = swing*0.6
      if (u.type === 'spearman') u.weapon.position.z = swing*0.12
    }
  }
}

export function createBuildingMesh(type: string, team: 'player'|'enemy'): THREE.Group {
  const g = new THREE.Group()
  const isPlayer = team==='player'
  const colWall = new THREE.MeshStandardMaterial({ color: isPlayer?0x8a9ab0:0x9a8a8a, roughness: 0.85 })
  const colRoof = new THREE.MeshStandardMaterial({ color: isPlayer?0x2a3a6a:0x6a2a2a, roughness: 0.6 })
  const colTrim = new THREE.MeshStandardMaterial({ color: isPlayer?0x3a5a9a:0x8a3a2a, roughness: 0.5, metalness: 0.1 })
  const wtype = type
  // base footprint
  const dims: Record<string,[number,number,number]> = {
    commandCenter:[3.2,1.6,3.2], barracks:[2.2,1.2,2.2], archeryRange:[2.2,1.1,2.2], stable:[2.4,1.1,2.2],
    siegeWorkshop:[2.2,1.0,2.2], supplyDepot:[2.0,0.8,1.2], watchtower:[0.9,2.2,0.9], wall:[1.0,0.9,1.0], gate:[1.0,1.0,1.0],
    fortress:[3.4,2.0,3.4], farm:[2.0,0.7,2.0], lumberCamp:[0.9,0.7,0.9], quarry:[0.9,0.6,0.9], mine:[0.9,0.7,0.9],
  }
  const [sx, sy, sz] = dims[wtype] ?? [1.5,1.0,1.5]
  const base = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), colWall); base.position.y = sy/2; base.castShadow=true; base.receiveShadow=true; g.add(base)
  // trim stripe
  const trim = new THREE.Mesh(new THREE.BoxGeometry(sx+0.02, 0.08, sz+0.02), colTrim); trim.position.y = sy*0.72; g.add(trim)
  // roof / detail
  if (wtype==='commandCenter' || wtype==='fortress') {
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(sx,sz)*0.7, 0.9, 4), colRoof); roof.position.y = sy + 0.45; roof.rotation.y = Math.PI/4; roof.castShadow=true; g.add(roof)
    // towers corners
    for (const dx of [-1,1]) for (const dz of [-1,1]) {
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.2, sy+0.5, 6), colWall); tw.position.set(dx*sx*0.42, (sy+0.5)/2, dz*sz*0.42); tw.castShadow=true; g.add(tw)
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.24,0.35,6), colRoof); cap.position.set(dx*sx*0.42, sy+0.5+0.18, dz*sz*0.42); g.add(cap)
    }
  } else if (wtype==='watchtower') {
    const plat = new THREE.Mesh(new THREE.BoxGeometry(0.95,0.12,0.95), colRoof); plat.position.y = sy - 0.05; g.add(plat)
    for (let i=0;i<4;i++){ const post=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.45,0.06), colWall); const a=i*Math.PI/2; post.position.set(Math.cos(a)*0.38, sy+0.18, Math.sin(a)*0.38); g.add(post) }
    const roof2=new THREE.Mesh(new THREE.ConeGeometry(0.55,0.5,4), colRoof); roof2.position.y = sy+0.55; roof2.rotation.y=Math.PI/4; g.add(roof2)
  } else if (wtype==='wall') {
    const cren = new THREE.Mesh(new THREE.BoxGeometry(sx,0.18,0.18), colWall); cren.position.set(0, sy+0.09, -0.2); g.add(cren)
    for(let i=0;i<3;i++){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.22,0.14), colWall); m.position.set((i-1)*0.28, sy+0.05, 0.22); g.add(m) }
  } else if (wtype==='barracks' || wtype==='archeryRange' || wtype==='stable') {
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.7, sx, 6, 1, false, 0, Math.PI), colRoof); roof.rotation.z = Math.PI/2; roof.rotation.x = 0; roof.position.set(0, sy+0.18, 0); roof.castShadow=true; g.add(roof)
    // door
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.45,0.65,0.04), new THREE.MeshStandardMaterial({ color: 0x3a2a1a })); door.position.set(0,0.33,-sz/2+0.02); g.add(door)
  } else if (wtype==='farm') {
    const field=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.02,1.7), new THREE.MeshStandardMaterial({ color: 0x6a8a3a })); field.position.y=0.02; g.add(field)
    for(let i=0;i<4;i++){ const row=new THREE.Mesh(new THREE.BoxGeometry(1.4,0.02,0.08), new THREE.MeshStandardMaterial({ color: 0x4a6a2a })); row.position.set(0,0.04,-0.5+i*0.22); g.add(row) }
  } else {
    const top = new THREE.Mesh(new THREE.BoxGeometry(sx*0.85,0.1,sz*0.85), colRoof); top.position.y = sy+0.05; g.add(top)
  }
  // flag
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,1.2,5), new THREE.MeshStandardMaterial({ color: 0x6a5a3a })); pole.position.set(sx*0.45, sy/2+0.3, sz*0.35); g.add(pole)
  const flag=new THREE.Mesh(new THREE.PlaneGeometry(0.4,0.25), new THREE.MeshStandardMaterial({ color: isPlayer?0x2a7ae0:0xc03020, side:THREE.DoubleSide })); flag.position.set(sx*0.45+0.2, sy/2+0.75, sz*0.35); flag.name='flag'; g.add(flag)
  // destruction state placeholder (smoke anchor)
  const smokeAnchor=new THREE.Group(); smokeAnchor.position.set(0, sy+0.3, 0); smokeAnchor.name='smokeAnchor'; g.add(smokeAnchor)
  g.userData = { sy, type, flag }
  g.traverse(o=>{ const m=o as THREE.Mesh; if(m.isMesh){ m.castShadow=true; m.receiveShadow=true }})
  return g
}

export function createTreeVariant(scale=1, variant=0): THREE.Group {
  const g=new THREE.Group()
  const trunkMat=new THREE.MeshStandardMaterial({ color: 0x4a2a1a, roughness: 0.9 })
  const leafMats=[
    new THREE.MeshStandardMaterial({ color: 0x2d5a18, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: 0x3a6a1e, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: 0x244a14, roughness: 0.85 }),
  ]
  const leafMat = leafMats[variant%leafMats.length]
  const trunkH = (1.1 + Math.random()*0.5)*scale
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08*scale, 0.13*scale, trunkH, 6), trunkMat); trunk.position.y = trunkH/2; trunk.castShadow=true; g.add(trunk)
  const crownY = trunkH - 0.1*scale
  const layers = 2 + (variant%2)
  for(let i=0;i<layers;i++){
    const r = (0.45 + (layers-i)*0.18)*scale
    const h = (0.55 + Math.random()*0.2)*scale
    const cone=new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), leafMat); cone.position.y = crownY + i*0.42*scale + h*0.35; cone.castShadow=true; cone.receiveShadow=true; g.add(cone)
  }
  // small bush base
  if (variant%3===0) {
    const bush=new THREE.Mesh(new THREE.SphereGeometry(0.22*scale, 6, 5), leafMat); bush.position.set((Math.random()-0.5)*0.3, 0.18*scale, (Math.random()-0.5)*0.3); bush.scale.y=0.6; g.add(bush)
  }
  g.userData = { scale }
  return g
}

export function createRock(scale=1): THREE.Mesh {
  const geo=new THREE.DodecahedronGeometry(0.35*scale, 0)
  const pos=geo.getAttribute('position') as THREE.BufferAttribute
  for(let i=0;i<pos.count;i++){ pos.setXYZ(i, pos.getX(i)+(Math.random()-0.5)*0.08*scale, pos.getY(i)+(Math.random()-0.5)*0.08*scale, pos.getZ(i)+(Math.random()-0.5)*0.08*scale) }
  pos.needsUpdate=true; geo.computeVertexNormals()
  const mesh=new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x6a6a6a, roughness: 0.9 }))
  mesh.castShadow=true; mesh.receiveShadow=true
  return mesh
}
