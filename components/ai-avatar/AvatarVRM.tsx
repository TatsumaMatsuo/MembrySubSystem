"use client";

// VRM(VRoid等)人型アバター(Epic #30 プロトタイプ)
//
// @pixiv/three-vrm で VRM を読み込み、標準表情で駆動する:
//   - 発話中: 口 "aa"(母音)を開閉
//   - 定期的に まばたき "blink"
// モデルは same-origin(public/avatars/*.vrm)配信。社内NWでも外部依存なく読める。
// RPMが社内NWからブロックされているため、CC0のVRoid女性モデルを既定採用。
import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import * as THREE from "three";

function Model({
  url,
  talking,
  thinking,
}: {
  url: string;
  talking: boolean;
  thinking: boolean;
}) {
  // GLTFLoader に VRM プラグインを登録して読み込み(型は three-stdlib と衝突するため any で受ける)
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    (loader as any).register((parser: any) => new VRMLoaderPlugin(parser));
  });
  const vrm = (gltf.userData as { vrm?: VRM }).vrm;
  const group = useRef<THREE.Group>(null);
  const blink = useRef(0);
  // 顔中心を原点付近へ持ち上げるYオフセット(モデルにより頭の高さが違うため実測)
  const [offsetY, setOffsetY] = useState(-1.35);

  useEffect(() => {
    if (!vrm) return;
    VRMUtils.rotateVRM0(vrm); // VRM0.x は既定で後ろ向き → 正面へ回転
    vrm.scene.traverse((o) => {
      o.frustumCulled = false;
    });
    // 頭の高さを「モデルローカル」で実測(ワールド座標だと親groupのoffsetが二重に効くため)
    vrm.scene.updateMatrixWorld(true);
    const sceneY = vrm.scene.getWorldPosition(new THREE.Vector3()).y;
    const head = vrm.humanoid?.getRawBoneNode("head");
    let localFaceY: number;
    if (head) {
      localFaceY = head.getWorldPosition(new THREE.Vector3()).y - sceneY + 0.08; // 目〜額あたり
    } else {
      localFaceY = new THREE.Box3().setFromObject(vrm.scene).max.y - sceneY - 0.13;
    }
    setOffsetY(-localFaceY);
  }, [vrm]);

  useFrame((state, delta) => {
    if (!vrm) return;
    const t = state.clock.elapsedTime;
    const em = vrm.expressionManager;
    if (em) {
      // 口パク(母音aa)。talking中はサイン波で開閉。
      const mouth = talking ? Math.min(1, Math.abs(Math.sin(t * 10)) * 0.9 + 0.05) : 0;
      em.setValue("aa", mouth);
      // まばたき(約4秒周期)
      blink.current += delta;
      const cyc = blink.current % 4;
      em.setValue("blink", cyc > 3.85 && cyc < 3.95 ? 1 : 0);
      // thinking 中は少し微笑
      em.setValue("happy", thinking ? 0.2 : 0);
    }
    if (group.current) {
      group.current.rotation.y = Math.sin(t * 0.5) * 0.06;
    }
    vrm.update(delta);
  });

  if (!vrm) return null;
  // VRoid 全身モデル(頭 ~y1.3)。頭部が中央に来るようオフセット。
  return (
    <group ref={group} position={[0, offsetY, 0]}>
      <primitive object={vrm.scene} />
    </group>
  );
}

export default function AvatarVRM({
  url,
  talking,
  thinking,
}: {
  url: string;
  talking: boolean;
  thinking: boolean;
}) {
  return (
    <div className="h-60 w-60 md:h-80 md:w-80">
      <Canvas camera={{ position: [0, -0.08, 1.15], fov: 30 }} dpr={[1, 2]}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[1.5, 2, 3]} intensity={1.2} />
        <directionalLight position={[-3, 1, 2]} intensity={0.35} color="#c7d2fe" />
        <Suspense fallback={null}>
          <Model url={url} talking={talking} thinking={thinking} />
        </Suspense>
      </Canvas>
    </div>
  );
}
