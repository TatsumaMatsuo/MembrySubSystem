"use client";

// 3D アバター(Epic #30 プロトタイプ)
//
// React Three Fiber + Three.js のプリミティブだけで自作(外部モデル/CDN非依存)。
//   - talking 中: 口(ellipsoid)を開閉
//   - 常時: まばたき + ゆるいアイドル揺れ
//   - thinking 中: 少し上を見る
// SSR回避のため page 側から next/dynamic(ssr:false) で読み込む前提。
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function Head({ talking, thinking }: { talking: boolean; thinking: boolean }) {
  const group = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const leftEye = useRef<THREE.Mesh>(null);
  const rightEye = useRef<THREE.Mesh>(null);
  const blink = useRef(0);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    // アイドル: ゆるい左右回転 + 上下バウンス。thinking 中は少し上を向く。
    if (group.current) {
      group.current.rotation.y = Math.sin(t * 0.6) * 0.15;
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        thinking ? -0.18 : 0,
        0.08
      );
      group.current.position.y = Math.sin(t * 1.2) * 0.03;
    }

    // 口パク: talking 中はサイン波で開閉、それ以外は薄く閉じる
    if (mouth.current) {
      const target = talking ? 0.35 + Math.abs(Math.sin(t * 12)) * 0.7 : 0.12;
      mouth.current.scale.y = THREE.MathUtils.lerp(mouth.current.scale.y, target, 0.4);
    }

    // まばたき: 約4秒周期で一瞬つぶる
    blink.current += delta;
    const cycle = blink.current % 4;
    const blinking = cycle > 3.85 && cycle < 3.95;
    const s = blinking ? 0.1 : 1;
    if (leftEye.current) leftEye.current.scale.y = THREE.MathUtils.lerp(leftEye.current.scale.y, s, 0.6);
    if (rightEye.current) rightEye.current.scale.y = THREE.MathUtils.lerp(rightEye.current.scale.y, s, 0.6);
  });

  return (
    <group ref={group}>
      {/* 頭 */}
      <mesh castShadow>
        <sphereGeometry args={[1, 48, 48]} />
        <meshStandardMaterial color="#fde0c8" roughness={0.65} metalness={0} />
      </mesh>
      {/* 目 */}
      <mesh ref={leftEye} position={[-0.34, 0.18, 0.86]}>
        <sphereGeometry args={[0.12, 24, 24]} />
        <meshStandardMaterial color="#37324a" />
      </mesh>
      <mesh ref={rightEye} position={[0.34, 0.18, 0.86]}>
        <sphereGeometry args={[0.12, 24, 24]} />
        <meshStandardMaterial color="#37324a" />
      </mesh>
      {/* ほお */}
      <mesh position={[-0.52, -0.08, 0.78]}>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshStandardMaterial color="#f9a8c4" transparent opacity={0.5} />
      </mesh>
      <mesh position={[0.52, -0.08, 0.78]}>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshStandardMaterial color="#f9a8c4" transparent opacity={0.5} />
      </mesh>
      {/* 口(ellipsoid: scale.y で開閉) */}
      <mesh ref={mouth} position={[0, -0.36, 0.9]} scale={[0.42, 0.12, 0.3]}>
        <sphereGeometry args={[0.4, 24, 24]} />
        <meshStandardMaterial color="#8b3a3a" />
      </mesh>
    </group>
  );
}

export default function Avatar3D({
  talking,
  thinking,
}: {
  talking: boolean;
  thinking: boolean;
}) {
  return (
    <div className="h-52 w-52 md:h-64 md:w-64">
      <Canvas camera={{ position: [0, 0, 3.2], fov: 42 }} dpr={[1, 2]}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[2, 3, 4]} intensity={1.1} />
        <directionalLight position={[-3, 1, 2]} intensity={0.35} color="#a5b4fc" />
        <Head talking={talking} thinking={thinking} />
      </Canvas>
    </div>
  );
}
