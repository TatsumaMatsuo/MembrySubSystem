"use client";

// Ready Player Me(glTF)アバター(Epic #30 プロトタイプ)
//
// RPMで作成した .glb を読み込み、blendshape(モーフ)で表情を駆動する:
//   - 発話中: 口(jawOpen / mouthOpen / viseme_aa 等)を開閉
//   - 定期的に まばたき(eyeBlinkLeft/Right 等)
// モデルURLは NEXT_PUBLIC_RPM_AVATAR_URL(未設定ならこのコンポーネントは使わない)。
//   ※RPM作成時に ?morphTargets=ARKit,Oculus Visemes を付けると口/瞬きモーフが同梱される。
//   ※本番は same-origin 配信のため public/ に同梱推奨(プロトタイプはRPM CDN直でも可)。
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// 口の開きに使う候補モーフ(モデルにあるものだけ適用)
const MOUTH_MORPHS = ["jawOpen", "mouthOpen", "viseme_aa", "viseme_O", "mouthShrugUpper"];
// まばたきに使う候補モーフ
const BLINK_MORPHS = ["eyeBlinkLeft", "eyeBlinkRight", "eyesClosed", "blink", "Blink"];

function Model({
  url,
  talking,
  thinking,
}: {
  url: string;
  talking: boolean;
  thinking: boolean;
}) {
  const { scene } = useGLTF(url);
  const blink = useRef(0);
  const group = useRef<THREE.Group>(null);

  // モーフを持つメッシュを収集
  const morphMeshes = useMemo(() => {
    const arr: THREE.Mesh[] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.morphTargetDictionary && m.morphTargetInfluences) arr.push(m);
    });
    return arr;
  }, [scene]);

  // 頭部が中央に来るよう自動オフセット(半身/全身どちらでも顔をフレームイン)
  const offsetY = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    return -(box.max.y - 0.12);
  }, [scene]);

  const setMorph = (names: string[], value: number) => {
    for (const mesh of morphMeshes) {
      const dict = mesh.morphTargetDictionary!;
      const infl = mesh.morphTargetInfluences!;
      for (const n of names) {
        const idx = dict[n];
        if (idx !== undefined) infl[idx] = value;
      }
    }
  };

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    // 口パク
    const mouth = talking ? Math.min(1, Math.abs(Math.sin(t * 10)) * 0.8 + 0.05) : 0;
    setMorph(MOUTH_MORPHS, mouth);

    // まばたき(約4秒周期)
    blink.current += delta;
    const cyc = blink.current % 4;
    setMorph(BLINK_MORPHS, cyc > 3.85 && cyc < 3.95 ? 1 : 0);

    // アイドル: ゆるい左右の首振り、thinking 中は少し上向き
    if (group.current) {
      group.current.rotation.y = Math.sin(t * 0.5) * 0.08;
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        thinking ? -0.1 : 0,
        0.06
      );
    }
  });

  return (
    <group ref={group}>
      <primitive object={scene} position={[0, offsetY, 0]} />
    </group>
  );
}

export default function AvatarRPM({
  url,
  talking,
  thinking,
}: {
  url: string;
  talking: boolean;
  thinking: boolean;
}) {
  return (
    <div className="h-56 w-56 md:h-72 md:w-72">
      <Canvas camera={{ position: [0, 0.02, 0.72], fov: 32 }} dpr={[1, 2]}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[1.5, 2, 3]} intensity={1.15} />
        <directionalLight position={[-3, 1, 2]} intensity={0.35} color="#c7d2fe" />
        <Suspense fallback={null}>
          <Model url={url} talking={talking} thinking={thinking} />
        </Suspense>
      </Canvas>
    </div>
  );
}
