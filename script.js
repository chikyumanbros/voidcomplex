document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    // 幅と高さの比率を1:1に近づける（正方形のグリッドになるように）
    const width = 250;
    const height = 140;
    
    // ASCII文字のセット（生命体の状態を表現）
    const asciiChars = '█▓▒░*+∙';
    
    // ライフシミュレーションのパラメータ
    const initialLifeCount = 50;  // 10から5に減少
    const maxLifeforms = 1000;    // 1000から500に減少
    const energyDecayRate = 0.003;  // 0.001から0.003に増加
    const reproductionThreshold = 0.8;  // 0.6から0.8に増加
    const reproductionCost = 0.3;   // 0.15から0.3に増加
    const mutationRate = 0.1;
    const foodGenerationRate = 0.05;  // 0.08から0.05に減少（食物生成を少し減らす、代わりに捕食が栄養源になる）
    const maxAge = 500;  // 1000から800に減少
    
    // 死骸のパラメータ
    const initialPlantDebrisCount = Math.floor(width * height * 0.00); // 画面の5%の量の初期植物死骸
    const initialLifeformDebrisCount = Math.floor(width * height * 0.01); // 画面の3%の量の初期生命体死骸
    
    // 浄化バクテリアのパラメータ
    const initialBacteriaCount = Math.floor(width * 0.25); // 画面の25%に増加
    const bacteriaPurificationRate = 0.01; // 毒素の浄化速度
    const bacteriaReproductionRate = 0.005; // 繁殖率を0.003から0.005に増加
    const bacteriaMaxCount = Math.floor(width * 0.20); // 最大数は画面の20%に増加
    
    // 酸素・二酸化炭素関連のパラメータ
    const oxygenConsumptionRate = 0.005; // 変更なし
    const oxygenProductionRate = 0.05;  // 0.008から0.05に増加
    const oxygenDiffusionRate = 0.02;    // 変更なし
    const maxOxygenLevel = 1.0;         
    const co2ProductionRate = 0.005;    // 変更なし
    const maxCO2Level = 1.0;           
    const initialOxygenDensity = 0.2; // 初期酸素濃度
    const initialCO2Density = 0.1;    // 初期CO2濃度
    const gridSize = 10; // 濃度グリッドのセルサイズ
    const gridWidth = Math.ceil(width / gridSize);
    const gridHeight = Math.ceil(height / gridSize);
    
    // 濃度マップの作成
    const oxygenMap = Array(gridWidth).fill().map(() => Array(gridHeight).fill(initialOxygenDensity));
    const co2Map = Array(gridWidth).fill().map(() => Array(gridHeight).fill(initialCO2Density));
    
    // 捕食関連のパラメータ
    const predationRange = 5;  // 捕食可能な距離
    const predationEnergyGain = 0.6;  // 捕食で得られるエネルギーの割合
    const predationSuccessRate = 0.7;  // 捕食の成功率（捕食者のサイズと被食者のサイズの比率に影響される）
    
    // アニメーションの状態
    let time = 0;
    
    // 生命体クラス
    class Lifeform {
        constructor(x, y, z, energy, dna = null) {
            // 位置を指定された場合のみ使用（ランダム生成を制限）
            this.position = {
                x: x !== undefined ? x : Math.random() * width,
                y: y !== undefined ? y : Math.random() * height,
                z: z || 0
            };
            
            // 速度（移動方向と速さ）
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.05 + Math.random() * 0.15;
            this.velocity = {
                x: Math.cos(angle) * speed,
                y: Math.sin(angle) * speed * 0.5,
                z: 0
            };
            
            // 加速度
            this.acceleration = { x: 0, y: 0, z: 0 };
            
            // 世代と遺伝的安定性を追加
            this.generation = 1;  // 初期世代
            this.ancestralStability = 1.0;  // 初期の遺伝的安定性（最大値）
            
            // 生命体の特性
            this.dna = dna || {
                // 基本的な特性
                speed: 0.2 + Math.random() * 0.2, // 0.3-0.6から0.2-0.4に減少（水中では最大速度を遅く）
                efficiency: 0.5 + Math.random() * 0.3,
                perception: 0.4 + Math.random() * 0.4,
                foodAttraction: 0.5 + Math.random() * 0.5,
                socialBehavior: Math.random() * 1.5 - 0.75,
                reproductionRate: 0.1 + Math.random() * 0.3,
                predatory: Math.random(),
                size: 0.2 + Math.random() * 0.4,
                
                // 向光性（光に対する反応）
                phototropism: Math.random() * 2 - 1, // -1〜1の範囲：負の値は避光性、正の値は向光性
                
                // Boidの動きに関する特性
                separationWeight: 0.5 + Math.random() * 0.3, // 0.7から0.5に減少（水中では個体間の距離が近くなる）
                alignmentWeight: 0.15 + Math.random() * 0.2, // 0.2から0.15に減少（水中では方向の一致が弱まる）
                cohesionWeight: 0.08 + Math.random() * 0.15, // 0.1から0.08に減少（水中では集団の凝集性が弱まる）
                
                // 繁殖戦略
                offspringCount: 1 + Math.floor(Math.random() * 3),
                parentalCare: Math.random(),
                
                // 特殊能力
                regenerationRate: Math.random() * 0.1,
                toxicity: Math.random() * 0.5,
                
                // 酸素関連の特性
                oxygenEfficiency: 0.5 + Math.random() * 0.3, // 酸素利用効率
                oxygenTolerance: 0.3 + Math.random() * 0.4,  // 低酸素耐性
            };
            
            // 生命体の状態
            this.energy = energy !== undefined ? energy : 0.8 + Math.random() * 0.2;
            this.age = 0;
            this.isDead = false;
            this.lastReproductionTime = 0;  // 最後に繁殖した時間
            
            // 捕食関連の状態
            this.lastPredationTime = 0;  // 最後に捕食した時間
            this.lastPredationAttemptTime = 0;  // 最後に捕食を試みた時間
            this.isPredator = this.dna.predatory > 0.6;  // 捕食性向が0.6以上なら捕食者
            
            // 生命体の色（DNAに基づく）
            // 捕食者は赤系、被食者は青系
            this.baseHue = this.isPredator ? 
                0 + Math.floor(this.dna.predatory * 60) :  // 赤〜黄色
                180 + Math.floor((1 - this.dna.predatory) * 60);  // 青〜シアン
            
            // 物理特性を更新
            this.mass = this.dna.size * 0.8 + 0.2;
            this.buoyancy = this.dna.size * 0.9 + 0.1;
            this.dragCoefficient = 0.3; // 0.1から0.3に増加（水中の抵抗を強化）
            
            // 捕食性を連続的な特性として扱う
            this.predatoryBehavior = this.dna.predatory; // 0-1の連続値
            
            // 捕食能力に影響する要素を複数組み合わせる
            this.huntingAbility = {
                strength: this.dna.size * 0.7 + this.dna.speed * 0.3,
                perception: this.dna.perception,
                aggressiveness: this.dna.predatory
            };

            this.toxicDamageResistance = 0.8; // 毒素へのダメージ耐性（0-1）
        }
        
        // 捕食の判定をより自然な形に
        canPredate(target) {
            const sizeDifference = this.dna.size / target.dna.size;
            const energyAdvantage = this.energy / target.energy;
            const predatoryDrive = this.predatoryBehavior;
            
            // 毒性による防御効果を追加
            const toxicityDefense = target.dna.toxicity * 0.8;
            
            // 複数の要因を組み合わせて捕食可能性を判定（毒性による防御を考慮）
            return (sizeDifference * energyAdvantage * predatoryDrive) > (0.5 + toxicityDefense);
        }
        
        // 色の計算も連続的に
        getDisplayColor() {
            // 捕食性の度合いに応じて連続的に色が変化
            const hue = 180 + this.predatoryBehavior * 180; // 0=青、1=赤の連続的な変化
            const saturation = 50 + this.energy * 50;
            const lightness = 70 - (this.age / this.maxAge) * 40;
            
            return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        }
        
        // 食物を探す
        seekFood(foods, bacteria) {  // bacteriaパラメータを追加
            let steering = { x: 0, y: 0, z: 0 };
            let closestDist = Infinity;
            let closestFood = null;
            
            // 知覚範囲を計算
            const perceptionRadius = 20 * this.dna.perception;
            
            // 植物を探す
            for (const food of foods) {
                const dx = food.position.x - this.position.x;
                const dy = food.position.y - this.position.y;
                const dz = food.position.z - this.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distance < perceptionRadius && distance < closestDist) {
                    closestDist = distance;
                    closestFood = food;
                }
            }

            // バクテリアも食物として探す
            for (const bacterium of bacteria) {
                const dx = bacterium.position.x - this.position.x;
                const dy = bacterium.position.y - this.position.y;
                const dz = bacterium.position.z - this.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distance < perceptionRadius && distance < closestDist) {
                    closestDist = distance;
                    closestFood = bacterium;
                }
            }
            
            if (closestFood) {
                // 最も近い食物に向かうベクトル
                steering.x = closestFood.position.x - this.position.x;
                steering.y = closestFood.position.y - this.position.y;
                steering.z = closestFood.position.z - this.position.z;
                
                // ベクトルの正規化
                const magnitude = Math.sqrt(
                    steering.x * steering.x + 
                    steering.y * steering.y + 
                    steering.z * steering.z
                );
                
                if (magnitude > 0) {
                    steering.x = (steering.x / magnitude) * this.dna.speed;
                    steering.y = (steering.y / magnitude) * this.dna.speed;
                    steering.z = (steering.z / magnitude) * this.dna.speed;
                }
                
                // 食物への引力を適用
                steering.x *= this.dna.foodAttraction;
                steering.y *= this.dna.foodAttraction;
                steering.z *= this.dna.foodAttraction;
            }
            
            return steering;
        }
        
        // 他の生命体との相互作用（捕食を含む）
        interact(lifeforms, toxicMatters, anaerobicBacteria) {
            let steering = { x: 0, y: 0, z: 0 };
            let count = 0;
            
            // Boidの動きのための変数
            let separation = { x: 0, y: 0, z: 0 };
            let alignment = { x: 0, y: 0, z: 0 };
            let cohesion = { x: 0, y: 0, z: 0 };
            let flockCount = 0;
            let avgPosition = { x: 0, y: 0, z: 0 };
            let avgVelocity = { x: 0, y: 0, z: 0 };
            
            // 捕食対象または仲間を探す
            let preyFound = false;
            let closestPreyDist = Infinity;
            let closestPrey = null;
            
            // 知覚範囲を計算
            const perceptionRadius = 15 * this.dna.perception;
            
            for (const other of lifeforms) {
                if (other === this || other.isDead) continue;
                
                const dx = other.position.x - this.position.x;
                const dy = other.position.y - this.position.y;
                const dz = other.position.z - this.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distance < perceptionRadius) {
                    // 捕食者の場合、被食者を探す
                    if (this.isPredator && !other.isPredator && distance < closestPreyDist) {
                        if (this.dna.size > other.dna.size * 0.8) {
                            closestPreyDist = distance;
                            closestPrey = other;
                            preyFound = true;
                        }
                    }
                    
                    // 同じタイプの生命体との群れ行動
                    if (this.isPredator === other.isPredator) {
                        // 分離（Separation）
                        const separationForce = 1 / Math.max(0.1, distance);
                        separation.x += (dx / distance) * -separationForce;
                        separation.y += (dy / distance) * -separationForce;
                        separation.z += (dz / distance) * -separationForce;
                        
                        // 整列（Alignment）
                        alignment.x += other.velocity.x;
                        alignment.y += other.velocity.y;
                        alignment.z += other.velocity.z;
                        
                        // 結合（Cohesion）
                        avgPosition.x += other.position.x;
                        avgPosition.y += other.position.y;
                        avgPosition.z += other.position.z;
                        
                        flockCount++;
                    }
                    
                    // 捕食者と被食者の関係に基づく追加の力
                    if (this.isPredator && !other.isPredator) {
                        // 捕食者は被食者に引き寄せられる
                        steering.x += dx * 0.5;
                        steering.y += dy * 0.5;
                        steering.z += dz * 0.5;
                    } else if (!this.isPredator && other.isPredator) {
                        // 被食者は捕食者から逃げる
                        steering.x -= dx;
                        steering.y -= dy;
                        steering.z -= dz;
                    }
                    
                    count++;
                }
            }
            
            // Boidの動きを適用
            if (flockCount > 0) {
                // 分離の正規化と重み付け
                const sepMag = Math.sqrt(
                    separation.x * separation.x +
                    separation.y * separation.y +
                    separation.z * separation.z
                );
                if (sepMag > 0) {
                    // 水中環境では分離の影響を弱める（より群れを形成しやすくする）
                    const waterFactor = 0.85; // 水中での影響係数
                    separation.x = (separation.x / sepMag) * this.dna.separationWeight * waterFactor;
                    separation.y = (separation.y / sepMag) * this.dna.separationWeight * waterFactor;
                    separation.z = (separation.z / sepMag) * this.dna.separationWeight * waterFactor;
                }
                
                // 整列の正規化と重み付け
                // 水中環境では整列の影響を強める（より同じ方向に泳ぐように）
                const alignWaterFactor = 1.2; // 水中での影響係数
                alignment.x = (alignment.x / flockCount) * this.dna.alignmentWeight * alignWaterFactor;
                alignment.y = (alignment.y / flockCount) * this.dna.alignmentWeight * alignWaterFactor;
                alignment.z = (alignment.z / flockCount) * this.dna.alignmentWeight * alignWaterFactor;
                
                // 結合の計算と重み付け
                avgPosition.x = avgPosition.x / flockCount;
                avgPosition.y = avgPosition.y / flockCount;
                avgPosition.z = avgPosition.z / flockCount;
                
                // 水中環境では結合の影響を強める（より群れを維持しやすくする）
                const cohesionWaterFactor = 1.15; // 水中での影響係数
                cohesion.x = (avgPosition.x - this.position.x) * this.dna.cohesionWeight * cohesionWaterFactor;
                cohesion.y = (avgPosition.y - this.position.y) * this.dna.cohesionWeight * cohesionWaterFactor;
                cohesion.z = (avgPosition.z - this.position.z) * this.dna.cohesionWeight * cohesionWaterFactor;
                
                // すべての力を合成
                // 水中環境では全体的な影響を弱める（より緩やかな動きに）
                const waterSteeringFactor = 0.8; // 水中での操舵力係数
                steering.x += (separation.x + alignment.x + cohesion.x) * waterSteeringFactor;
                steering.y += (separation.y + alignment.y + cohesion.y) * waterSteeringFactor;
                steering.z += (separation.z + alignment.z + cohesion.z) * waterSteeringFactor;
            }
            
            // 捕食行動
            if (preyFound && closestPrey && closestPreyDist < predationRange) {
                // 前回の捕食試行から一定時間経過している場合のみ捕食を試みる
                if (time - this.lastPredationAttemptTime > 20) {
                    this.lastPredationAttemptTime = time;
                    
                    // 捕食の成功率はサイズの差と基本成功率に依存
                    const sizeDifference = this.dna.size / closestPrey.dna.size;
                    const successChance = predationSuccessRate * sizeDifference;
                    
                    if (Math.random() < successChance) {
                        // 捕食成功
                        this.lastPredationTime = time;
                        
                        // 獲物からエネルギーを得る
                        const gainedEnergy = closestPrey.energy * predationEnergyGain;
                        this.energy += gainedEnergy;
                        this.energy = Math.min(this.energy, 1.0);  // エネルギー上限
                        
                        // 獲物を死亡させる
                        closestPrey.isDead = true;
                    }
                }
            }
            
            if (count > 0) {
                steering.x /= count;
                steering.y /= count;
                steering.z /= count;
                
                // ベクトルの正規化と速度の適用
                const magnitude = Math.sqrt(
                    steering.x * steering.x + 
                    steering.y * steering.y + 
                    steering.z * steering.z
                );
                
                if (magnitude > 0) {
                    steering.x = (steering.x / magnitude) * this.dna.speed * 0.5;
                    steering.y = (steering.y / magnitude) * this.dna.speed * 0.5;
                    steering.z = (steering.z / magnitude) * this.dna.speed * 0.5;
                }
            }
            
            // 毒素からの逃避行動
            const { nearestToxic, nearestDistance } = this.checkToxicInteraction(toxicMatters);
            if (nearestToxic) {
                const toxicPerceptionRadius = 20; // 毒素の知覚範囲
                if (nearestDistance < toxicPerceptionRadius) {
                    const dx = nearestToxic.position.x - this.position.x;
                    const dy = nearestToxic.position.y - this.position.y;
                    const dz = nearestToxic.position.z - this.position.z;
                    
                    // 距離に応じた逃避力を計算（近いほど強い）
                    const avoidanceForce = (toxicPerceptionRadius - nearestDistance) / toxicPerceptionRadius * 2;
                    steering.x -= dx * avoidanceForce;
                    steering.y -= dy * avoidanceForce;
                    steering.z -= dz * avoidanceForce;
                }
            }
            
            // 好気性バクテリアとの相互作用
            if (bacteria) {
                for (const bacterium of bacteria) {
                    if (!bacterium || bacterium.isDead) continue;
                    
                    const dx = bacterium.position.x - this.position.x;
                    const dy = bacterium.position.y - this.position.y;
                    const dz = bacterium.position.z - this.position.z;
                    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    
                    if (distance < perceptionRadius) {
                        // 捕食可能な距離内にいる場合
                        if (distance < predationRange && this.canPredate({ dna: { size: 0.5, toxicity: 0 }, energy: 0.3 })) {
                            // バクテリアを捕食し、エネルギーを得る
                            this.energy += predationEnergyGain * 0.3;  // バクテリアからのエネルギー獲得は通常の30%
                            bacterium.isDead = true;
                        }
                    }
                }
            }

            // 嫌気性バクテリアとの相互作用
            if (anaerobicBacteria) {  // 捕食性の条件を削除
                for (const bacteria of anaerobicBacteria) {
                    if (!bacteria || bacteria.isDead) continue;
                    
                    const dx = bacteria.position.x - this.position.x;
                    const dy = bacteria.position.y - this.position.y;
                    const dz = bacteria.position.z - this.position.z;
                    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    
                    if (distance < perceptionRadius) {
                        // 捕食可能な距離内にいる場合
                        if (distance < predationRange && this.canPredate({ dna: { size: 0.5, toxicity: 0 }, energy: 0.3 })) {
                            // バクテリアを捕食し、エネルギーを得る
                            this.energy += predationEnergyGain * 0.3;  // バクテリアからのエネルギー獲得は通常の30%
                            bacteria.isDead = true;
                        }
                    }
                }
            }
            
            return steering;
        }
        
        // 境界を超えないようにする力
        checkBoundaries() {
            const margin = 2;
            let force = { x: 0, y: 0, z: 0 };
            const boundaryForce = 0.05;
            
            // 水平方向の境界
            if (this.position.x < margin) {
                force.x = boundaryForce;
            } else if (this.position.x > width - margin) {
                force.x = -boundaryForce;
            }
            
            // 垂直方向の境界（水面と底面で異なる挙動）
            const surfaceMargin = 3;
            const bottomMargin = 4;
            
            if (this.position.y < surfaceMargin) {
                // 水面付近での挙動
                const depthFactor = this.position.y / surfaceMargin;
                force.y = boundaryForce * (1 - depthFactor) * 0.8;
                
                // 酸素レベルが高い場合、より強く押し下げる
                const surfaceOxygen = getOxygenAt(this.position.x, 0);
                if (surfaceOxygen > 0.5) {
                    force.y += boundaryForce * 0.4;
                }
            } else if (this.position.y > height - bottomMargin) {
                // 底面付近での挙動
                const heightFactor = (height - this.position.y) / bottomMargin;
                force.y = -boundaryForce * (1 - heightFactor);
                
                // 毒性物質が多い場合、より強く押し上げる
                const toxicCount = this.countNearbyToxic();
                if (toxicCount > 2) {
                    force.y -= boundaryForce * 0.3;
                }
            }
            
            return force;
        }
        
        // 近くの毒性物質をカウント
        countNearbyToxic() {
            if (!this.toxicMatters) return 0;
            
            let count = 0;
            const checkRadius = 5;
            
            for (const toxic of this.toxicMatters) {
                if (!toxic || toxic.decompositionStage === 2) continue;
                
                const dx = this.position.x - toxic.position.x;
                const dy = this.position.y - toxic.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < checkRadius) {
                    count++;
                }
            }
            
            return count;
        }
        
        // 物理演算を適用
        applyPhysics() {
            // 重力（下向きの力）- 運動力が低いほど重力の影響が小さくなる
            const gravity = 0.01 * this.mass * (0.5 + this.dna.speed * 0.5);
            
            // 浮力（上向きの力）- 運動力が低いほど浮力が強くなる
            const depth = this.position.y / height;
            const buoyancyMultiplier = 1.5 - this.dna.speed; // 運動力が低いほど大きな値に
            const buoyancyForce = -0.015 * this.buoyancy * (depth + 0.2) * buoyancyMultiplier;
            
            // 水の抵抗（速度に比例、逆向きの力）- 運動力が低いほど抵抗が大きくなる
            const dragMultiplier = 1.5 - this.dna.speed * 0.5; // 1.2から1.5に増加
            const dragForce = {
                x: -this.velocity.x * this.dragCoefficient * dragMultiplier,
                y: -this.velocity.y * this.dragCoefficient * dragMultiplier,
                z: -this.velocity.z * this.dragCoefficient * 0.5 // Z軸方向の抵抗を弱く設定（深度情報として使用）
            };
            
            // 合力を加速度に適用
            this.acceleration.y += gravity + buoyancyForce;
            this.acceleration.x += dragForce.x;
            this.acceleration.y += dragForce.y;
            this.acceleration.z += dragForce.z; // Z軸方向の抵抗を適用（弱く）
        }
        
        // 生命体の更新
        update(lifeforms, foods, toxicMatters, anaerobicBacteria) {  // anaerobicBacteriaパラメータを追加
            if (this.isDead) return;
            
            // 年齢を増加
            this.age++;
            
            // エネルギーコストを計算して適用
            const costs = this.calculateEnergyCosts();
            this.energy -= costs.totalCost;

            // 酸素消費と二酸化炭素生成の処理
            let oxygenAvailable = false;
            let consumedOxygen = 0;
            let suffocating = true; // 窒息状態のフラグ
            
            // 現在位置の酸素を消費
            const currentOxygen = getOxygenAt(this.position.x, this.position.y);
            const neededOxygen = costs.oxygenConsumption * (1 - this.dna.oxygenEfficiency * 0.4); // 効率の影響を40%に緩和
            
            if (currentOxygen > 0) {
                consumedOxygen = Math.min(neededOxygen, currentOxygen);
                changeOxygenAt(this.position.x, this.position.y, -consumedOxygen);
                oxygenAvailable = true;
                suffocating = consumedOxygen < neededOxygen * 0.6; // 必要量の60%以下で窒息状態に（70%から緩和）
                
                // CO2を生成（消費した酸素量に応じて）
                const co2Amount = consumedOxygen * 1.1; // CO2生成量を適度に調整（1.2から1.1に）
                changeCO2At(this.position.x, this.position.y, co2Amount);
            }
            
            // 窒息状態の場合、エネルギー消費が増加
            if (suffocating) {
                this.energy -= energyDecayRate * 4; // ペナルティを適度に調整（5倍から4倍に）
                
                // 窒息による色の変化を調整
                this.suffocationLevel = Math.min(1, this.suffocationLevel + 0.07); // 0.1から0.07に緩和
            } else {
                // 窒息状態からの回復を調整
                this.suffocationLevel = Math.max(0, this.suffocationLevel - 0.015); // 0.01から0.015に回復速度を上昇
            }
            
            // 周囲のCO2濃度が高すぎる場合の処理
            let highCO2 = false;
            for (let x = 0; x < gridWidth; x++) {
                for (let y = 0; y < gridHeight; y++) {
                    if (co2Map[x][y] > 0.6) { // CO2耐性閾値を適度に調整（0.5から0.6に）
                        highCO2 = true;
                        break;
                    }
                }
                if (highCO2) break;
            }
            
            // CO2濃度が高い場合のペナルティを調整
            if (highCO2) {
                this.energy -= 0.025 * (1 - this.dna.oxygenTolerance); // 0.03から0.025に緩和
            }
            
            // 自然回復（酸素が十分にある場合のみ）
            if (oxygenAvailable && !highCO2) {
                this.energy += this.dna.regenerationRate;
                this.energy = Math.min(this.energy, 1.0);
            }
            
            // 食物を探す力（バクテリアも含める）
            const foodSeeking = this.seekFood(foods, bacteria);
            
            // 他の生命体との相互作用
            const interaction = this.interact(lifeforms, toxicMatters, anaerobicBacteria);  // anaerobicBacteriaを追加
            
            // 境界チェックを更新
            const boundaries = this.checkBoundaries();
            
            // 光に対する反応を取得
            const lightResponse = this.respondToLight();
            
            // 力を適用（光への反応を追加）
            this.acceleration.x += (foodSeeking.x + interaction.x + boundaries.x + lightResponse.x) * 0.5;
            this.acceleration.y += (foodSeeking.y + interaction.y + boundaries.y + lightResponse.y) * 0.5;
            this.acceleration.z += (foodSeeking.z + interaction.z + boundaries.z + lightResponse.z) * 0.5;
            
            // 物理演算を適用
            this.applyPhysics();
            
            // 速度を更新
            this.velocity.x += this.acceleration.x;
            this.velocity.y += this.acceleration.y;
            this.velocity.z += this.acceleration.z;
            
            // 水中の抵抗による速度減衰を追加
            const velocityDamping = 0.95 + (this.dna.speed * 0.03); // 速度減衰係数（運動力が高いほど減衰が少ない）
            this.velocity.x *= velocityDamping;
            this.velocity.y *= velocityDamping;
            this.velocity.z *= 0.98; // Z軸方向は弱い減衰のみ適用（深度情報として使用）
            
            // 速度を制限
            const speed = Math.sqrt(
                this.velocity.x * this.velocity.x + 
                this.velocity.y * this.velocity.y + 
                this.velocity.z * this.velocity.z
            );
            
            const maxSpeed = 0.35 * this.dna.speed; // 0.5から0.35に減少（水中では最大速度を制限）
            
                if (speed > maxSpeed) {
                    this.velocity.x = (this.velocity.x / speed) * maxSpeed;
                    this.velocity.y = (this.velocity.y / speed) * maxSpeed;
                    this.velocity.z = (this.velocity.z / speed) * maxSpeed;
            }
            
            // 位置を更新
            this.position.x += this.velocity.x;
            this.position.y += this.velocity.y;
            this.position.z += this.velocity.z;
            
            // 加速度をリセット
            this.acceleration.x = 0;
            this.acceleration.y = 0;
            this.acceleration.z = 0;
            
            // 食物との衝突判定と摂取（バクテリアも含める）
            this.eatFood(foods, bacteria);
            
            // 繁殖判定
            if (this.energy > reproductionThreshold && 
                Math.random() < this.dna.reproductionRate * 0.02 && // 0.05から0.02に減少
                time - this.lastReproductionTime > 150) {  // 100から150に増加
                this.reproduce(lifeforms);
            }
            
            // 死亡判定をシンプルに
            if (this.energy <= 0 || this.age >= maxAge) {
                this.isDead = true;
            }

            // 毒素との相互作用によるダメージ
            const { totalDamage } = this.checkToxicInteraction(toxicMatters);
            if (totalDamage > 0) {
                this.energy -= totalDamage;
                if (this.energy <= 0) {
                    this.isDead = true;
                    return;
                }
            }
        }
        
        // 食物を食べる
        eatFood(foods, bacteria) {  // bacteriaパラメータを追加
            const eatDistance = 4;
            
            // 植物を食べる
            for (let i = foods.length - 1; i >= 0; i--) {
                const food = foods[i];
                const dx = this.position.x - food.position.x;
                const dy = this.position.y - food.position.y;
                const dz = this.position.z - food.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                // 植物の根本（底部）付近でのみ食べられるように
                const isNearBase = Math.abs(this.position.y - food.position.y) < 3;
                
                // 植物が十分に成長していない場合のみ食べられる
                const isEatable = food.growthHeight < 5 && food.size < food.maxSize * 0.4;
                
                if (distance < eatDistance && isNearBase && isEatable) {
                    const damageAmount = 0.2 + (this.dna.size * 0.3);
                    const killed = food.takeDamage(damageAmount);
                    // エネルギー獲得量を植物の成長度に応じて減少
                    const maturityPenalty = 1 - (food.growthHeight / 5);
                    const gainedEnergy = food.size * food.energy * 0.3 * maturityPenalty;
                    this.energy += gainedEnergy;
                    this.energy = Math.min(this.energy, 1.0);

                    if (killed) {
                        foods.splice(i, 1);
                    }
                }
            }

            // バクテリアを食べる
            for (let i = bacteria.length - 1; i >= 0; i--) {
                const bacterium = bacteria[i];
                const dx = this.position.x - bacterium.position.x;
                const dy = this.position.y - bacterium.position.y;
                const dz = this.position.z - bacterium.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distance < eatDistance) {
                    // バクテリアを捕食
                    const gainedEnergy = bacterium.energy * 0.4;
                    this.energy += gainedEnergy;
                    this.energy = Math.min(this.energy, 1.0);

                    // バクテリアの再生処理
                    const newBacterium = new PurifierBacteria(
                        bacterium.position.x + (Math.random() - 0.5) * 4,
                        bacterium.position.y + (Math.random() - 0.5) * 4,
                        0
                    );
                    newBacterium.energy = 0.3;
                    newBacterium.purificationEfficiency = bacterium.purificationEfficiency * 0.9;
                    bacteria.splice(i, 1);
                    bacteria.push(newBacterium);
                }
            }
        }
        
        // 繁殖
        reproduce(lifeforms) {
            if (lifeforms.length >= maxLifeforms) return;
            if (time - this.lastReproductionTime < 100) return;  // 50から100に増加
            
            this.lastReproductionTime = time;
            
            // 親のエネルギー消費（子育ての度合いに応じて）
            const parentalInvestment = this.energy * 0.5; // 親のエネルギーの半分を投資
            this.energy -= parentalInvestment;
            
            // 複数の子孫を生成
            const offspringCount = this.dna.offspringCount;
            const energyPerChild = parentalInvestment / offspringCount; // 投資したエネルギーを均等に分配
            
            // ストレス要因に基づく変異率の調整
            let stressFactor = 1.0;
            
            // 1. エネルギーが低い（ダメージを負っている）場合のストレス
            const energyStress = 1.0 + Math.max(0, (0.7 - this.energy) * 2);
            
            // 2. 毒素ダメージによるストレス
            const toxicStress = this.countNearbyToxic() > 0 ? 1.5 : 1.0;
            
            // 3. マップ上方にいるほど変異率が上がる（Y座標が小さいほど上）
            const heightFactor = 1.0 + Math.max(0, (height - this.position.y) / height);
            
            // 総合的なストレス係数を計算
            stressFactor = energyStress * toxicStress * heightFactor;
            
            // 変異率に制限を設ける（最大で通常の3倍まで）
            stressFactor = Math.min(3.0, stressFactor);
            
            for (let i = 0; i < offspringCount; i++) {
                // 子孫のDNAを作成（突然変異を含む）
                const childDna = {};
                for (const [key, value] of Object.entries(this.dna)) {
                    // 各特性に突然変異を適用（ストレス係数を考慮）
                    const mutation = (Math.random() * 2 - 1) * mutationRate * stressFactor;
                    // 特性に応じて突然変異の影響を調整
                    const mutationScale = key === 'predatory' ? 0.5 : 1.0;
                    childDna[key] = value + mutation * mutationScale;
                    
                    // 値を適切な範囲に制限
                    if (key === 'socialBehavior') {
                        childDna[key] = Math.max(-1.0, Math.min(1.0, childDna[key]));
                    } else if (key === 'predatory') {
                        childDna[key] = Math.max(0.0, Math.min(1.0, childDna[key]));
                    } else if (key === 'offspringCount') {
                        childDna[key] = Math.max(1, Math.min(5, Math.round(childDna[key])));
                    } else {
                        childDna[key] = Math.max(0.1, Math.min(1.5, childDna[key]));
                    }
                }
                
                // 子孫を生成（エネルギーは親からの分配のみ）
                const offsetDistance = 2 + this.dna.parentalCare * 3;
                const offsetX = (Math.random() - 0.5) * offsetDistance;
                const offsetY = (Math.random() - 0.5) * offsetDistance;
                const offsetZ = (Math.random() - 0.5) * offsetDistance;
                
                const child = new Lifeform(
                    this.position.x + offsetX,
                    this.position.y + offsetY,
                    this.position.z + offsetZ,
                    energyPerChild, // 親から分配されたエネルギーのみを使用
                    childDna
                );
                
                lifeforms.push(child);
            }
        }

        // 毒素との相互作用をチェック
        checkToxicInteraction(toxicMatters) {
            let totalDamage = 0;
            let nearestToxic = null;
            let nearestDistance = Infinity;

            for (const toxic of toxicMatters) {
                if (toxic.decompositionStage !== 0) continue; // 未分解の毒素のみ

                const dx = toxic.position.x - this.position.x;
                const dy = toxic.position.y - this.position.y;
                const dz = toxic.position.z - this.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

                // 接触判定（サイズを考慮）
                const contactThreshold = (this.size + 1) * 0.5;
                if (distance < contactThreshold) {
                    // 毒性に応じたダメージを計算
                    const toxicDamage = toxic.toxicity * 0.05 * (1 - this.toxicDamageResistance);
                    totalDamage += toxicDamage;
                }

                // 最も近い毒素を記録（逃避行動用）
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestToxic = toxic;
                }
            }

            return { totalDamage, nearestToxic, nearestDistance };
        }

        // 光に対する反応（向光性/避光性）
        respondToLight() {
            // 水面からの距離に基づいて光の強さを計算
            // 水面に近いほど光が強い
            const depthRatio = 1 - (this.position.y / height);
            const lightIntensity = Math.max(0, 1 - depthRatio * 1.5); // 水深による光の減衰
            
            // 向光性に基づく動き
            // phototropismが正の値なら光に向かう（上に移動）
            // phototropismが負の値なら光から離れる（下に移動）
            const phototropicForce = this.dna.phototropism * lightIntensity * 0.02;
            
            // 返却値は加速度への影響
            return { 
                x: 0, 
                y: -phototropicForce, // 負の値は上向き（水面方向）
                z: 0 
            };
        }

        // DNAを文字列に変換するメソッドを追加
        getDNAString() {
            // 各パラメータを2桁の16進数に変換する関数
            const toHex = (value) => {
                // 0-1の値を0-255の範囲に変換して16進数に
                const hex = Math.floor(value * 255).toString(16).padStart(2, '0');
                return hex;
            };

            // 特殊なパラメータの処理
            const offspringCountHex = this.dna.offspringCount.toString(16).padStart(2, '0');
            const socialBehaviorHex = toHex((this.dna.socialBehavior + 1) / 2); // -1〜1の値を0〜1に正規化

            // DNAパラメータを文字列化
            const dnaString = 
                toHex(this.dna.speed) +
                toHex(this.dna.efficiency) +
                toHex(this.dna.perception) +
                toHex(this.dna.foodAttraction) +
                socialBehaviorHex +
                toHex(this.dna.reproductionRate) +
                toHex(this.dna.predatory) +
                toHex(this.dna.size) +
                toHex(this.dna.phototropism) +
                toHex(this.dna.separationWeight) +
                toHex(this.dna.alignmentWeight) +
                toHex(this.dna.cohesionWeight) +
                offspringCountHex +
                toHex(this.dna.parentalCare) +
                toHex(this.dna.regenerationRate) +
                toHex(this.dna.toxicity) +
                toHex(this.dna.oxygenEfficiency) +
                toHex(this.dna.oxygenTolerance);

            return dnaString;
        }

        // 文字列からDNAを復元するメソッド
        static fromDNAString(dnaString) {
            // 16進数の文字列を0-1の値に変換する関数
            const fromHex = (hex) => {
                return parseInt(hex, 16) / 255;
            };

            // DNAパラメータを2文字ずつ取り出して変換
            const dna = {
                speed: fromHex(dnaString.substr(0, 2)),
                efficiency: fromHex(dnaString.substr(2, 2)),
                perception: fromHex(dnaString.substr(4, 2)),
                foodAttraction: fromHex(dnaString.substr(6, 2)),
                socialBehavior: fromHex(dnaString.substr(8, 2)) * 2 - 1, // 0〜1の値を-1〜1に戻す
                reproductionRate: fromHex(dnaString.substr(10, 2)),
                predatory: fromHex(dnaString.substr(12, 2)),
                size: fromHex(dnaString.substr(14, 2)),
                phototropism: fromHex(dnaString.substr(16, 2)),
                separationWeight: fromHex(dnaString.substr(18, 2)),
                alignmentWeight: fromHex(dnaString.substr(20, 2)),
                cohesionWeight: fromHex(dnaString.substr(22, 2)),
                offspringCount: parseInt(dnaString.substr(24, 2), 16),
                parentalCare: fromHex(dnaString.substr(26, 2)),
                regenerationRate: fromHex(dnaString.substr(28, 2)),
                toxicity: fromHex(dnaString.substr(30, 2)),
                oxygenEfficiency: fromHex(dnaString.substr(32, 2)),
                oxygenTolerance: fromHex(dnaString.substr(34, 2))
            };

            return dna;
        }

        // DNAに基づいてエネルギーコストを計算するメソッド
        calculateEnergyCosts() {
            // 基礎代謝コスト（サイズと効率に基づく）
            const baseMetabolism = 0.001 * (this.dna.size * 1.5) * (1 - this.dna.efficiency * 0.5);

            // 活動コスト（速度と知覚に基づく）
            const activityCost = 0.002 * (this.dna.speed * 1.2 + this.dna.perception * 0.8);

            // 特殊能力のコスト
            const specialAbilitiesCost = 
                (this.dna.regenerationRate * 0.01) +  // 再生能力
                (this.dna.toxicity * 0.005) +         // 毒素維持
                (Math.abs(this.dna.phototropism) * 0.002); // 光応答

            // 社会的行動のコスト
            const socialCost = Math.abs(this.dna.socialBehavior) * 0.001;

            // 捕食者の場合の追加コスト
            const predatorCost = this.dna.predatory > 0.5 ? this.dna.predatory * 0.003 : 0;

            // 酸素消費量（効率に応じて変動）
            const oxygenConsumption = 0.005 * (1 - this.dna.oxygenEfficiency * 0.4);

            return {
                baseMetabolism,
                activityCost,
                specialAbilitiesCost,
                socialCost,
                predatorCost,
                oxygenConsumption,
                totalCost: baseMetabolism + activityCost + specialAbilitiesCost + socialCost + predatorCost
            };
        }

        // 生存に必要な最小エネルギーを計算
        calculateMinimumEnergy() {
            const costs = this.calculateEnergyCosts();
            // 1000フレーム（約16.7秒）生存するのに必要なエネルギー
            return costs.totalCost * 1000;
        }

        // 繁殖に必要なエネルギーを計算
        calculateReproductionEnergy() {
            // 基本コスト
            const baseCost = 0.3;
            
            // 子孫数による追加コスト
            const offspringCost = this.dna.offspringCount * 0.1;
            
            // 育児ケアによる追加コスト
            const parentalCost = this.dna.parentalCare * 0.2;
            
            // DNAの複雑さに基づくコスト（全てのDNA値の平均）
            const dnaComplexity = Object.values(this.dna).reduce((sum, value) => {
                return sum + (typeof value === 'number' ? value : 0);
            }, 0) / Object.values(this.dna).length;
            
            return baseCost + offspringCost + parentalCost + (dnaComplexity * 0.1);
        }

        // エネルギー情報を文字列として取得
        getEnergyRequirements() {
            const costs = this.calculateEnergyCosts();
            const minimumEnergy = this.calculateMinimumEnergy();
            const reproductionEnergy = this.calculateReproductionEnergy();

            return `エネルギー要件:
                基礎代謝: ${(costs.baseMetabolism * 1000).toFixed(3)}/秒
                活動コスト: ${(costs.activityCost * 1000).toFixed(3)}/秒
                特殊能力: ${(costs.specialAbilitiesCost * 1000).toFixed(3)}/秒
                社会行動: ${(costs.socialCost * 1000).toFixed(3)}/秒
                捕食者コスト: ${(costs.predatorCost * 1000).toFixed(3)}/秒
                酸素消費: ${(costs.oxygenConsumption * 1000).toFixed(3)}/秒
                総コスト: ${(costs.totalCost * 1000).toFixed(3)}/秒
                
                生存必要エネルギー: ${minimumEnergy.toFixed(3)}
                繁殖必要エネルギー: ${reproductionEnergy.toFixed(3)}`;
        }

        // DNAの可読性の高い文字列表現を取得するメソッドを更新
        getDNADescription() {
            const basicInfo = `Lifeform DNA Information:
                Speed: ${(this.dna.speed * 100).toFixed(1)}%
                Efficiency: ${(this.dna.efficiency * 100).toFixed(1)}%
                Perception: ${(this.dna.perception * 100).toFixed(1)}%
                Food Attraction: ${(this.dna.foodAttraction * 100).toFixed(1)}%
                Social Behavior: ${(this.dna.socialBehavior * 100).toFixed(1)}%
                Reproduction Rate: ${(this.dna.reproductionRate * 100).toFixed(1)}%
                Predatory: ${(this.dna.predatory * 100).toFixed(1)}%
                Size: ${(this.dna.size * 100).toFixed(1)}%
                Phototropism: ${(this.dna.phototropism * 100).toFixed(1)}%
                Separation Weight: ${(this.dna.separationWeight * 100).toFixed(1)}%
                Alignment Weight: ${(this.dna.alignmentWeight * 100).toFixed(1)}%
                Cohesion Weight: ${(this.dna.cohesionWeight * 100).toFixed(1)}%
                Offspring Count: ${this.dna.offspringCount}
                Parental Care: ${(this.dna.parentalCare * 100).toFixed(1)}%
                Regeneration Rate: ${(this.dna.regenerationRate * 100).toFixed(1)}%
                Toxicity: ${(this.dna.toxicity * 100).toFixed(1)}%
                Oxygen Efficiency: ${(this.dna.oxygenEfficiency * 100).toFixed(1)}%
                Oxygen Tolerance: ${(this.dna.oxygenTolerance * 100).toFixed(1)}%
                
                Generation: ${this.generation}
                Genetic Stability: ${(this.ancestralStability * 100).toFixed(1)}%`;

            return basicInfo + '\n\n' + this.getEnergyRequirements();
        }

        // 遺伝情報を取得（子孫に渡すため）
        getGeneticCode() {
            return {
                dnaString: this.getDNAString(),
                generation: this.generation || 1,
                ancestralStability: this.ancestralStability || 1.0
            };
        }

        // 遺伝情報から生命体を生成（静的メソッド）
        static fromGeneticCode(geneticCode, x, y, z, energy) {
            const dna = Lifeform.fromDNAString(
                Lifeform.mutateGeneticCode(
                    geneticCode.dnaString,
                    geneticCode.generation,
                    geneticCode.ancestralStability
                )
            );
            
            const offspring = new Lifeform(x, y, z, energy, dna);
            offspring.generation = geneticCode.generation + 1;
            
            // 世代を重ねるごとに遺伝的安定性が少しずつ低下
            offspring.ancestralStability = Math.max(
                0.1,
                geneticCode.ancestralStability * 0.995
            );
            
            return offspring;
        }

        // 遺伝情報に変異を加える（静的メソッド）
        static mutateGeneticCode(dnaString, generation, stability) {
            const mutationRate = 0.05 * (1 - stability); // 基本変異率（安定性が低いほど高くなる）
            let mutatedDna = '';
            
            // 2文字ずつ処理（16進数のペア）
            for (let i = 0; i < dnaString.length; i += 2) {
                const genePair = dnaString.substr(i, 2);
                
                // 遺伝子の位置に基づく変異率の調整
                // 前半の遺伝子（基本的な特性）ほど変異しやすい
                const positionFactor = 1 - (i / dnaString.length);
                const geneComplexity = parseInt(genePair, 16) / 255; // 遺伝子の複雑さ（値が大きいほど複雑）
                
                // 最終的な変異率の計算
                const finalMutationRate = mutationRate * 
                    positionFactor * // 位置による影響
                    (1 + generation * 0.01) * // 世代による影響
                    (1 - geneComplexity * 0.5); // 複雑さによる影響
                
                if (Math.random() < finalMutationRate) {
                    // 変異の強度を計算（0.8-1.2の範囲）
                    const mutationStrength = 0.8 + Math.random() * 0.4;
                    
                    // 16進数値を10進数に変換
                    let value = parseInt(genePair, 16);
                    
                    // 値を変異させる
                    value = Math.floor(value * mutationStrength);
                    value = Math.max(0, Math.min(255, value)); // 0-255の範囲に収める
                    
                    // 16進数に戻して2桁に整形
                    mutatedDna += value.toString(16).padStart(2, '0');
                } else {
                    mutatedDna += genePair;
                }
            }
            
            return mutatedDna;
        }

        // 繁殖メソッドを更新
        reproduce(lifeforms) {
            if (lifeforms.length >= maxLifeforms) return;
            if (time - this.lastReproductionTime < 100) return;
            
            this.lastReproductionTime = time;
            
            // 親のエネルギー消費（子育ての度合いに応じて）
            const parentalInvestment = this.energy * 0.5;
            this.energy -= parentalInvestment;
            
            // 遺伝情報を取得
            const geneticCode = this.getGeneticCode();
            
            // 複数の子孫を生成
            const offspringCount = this.dna.offspringCount;
            const energyPerChild = parentalInvestment / offspringCount;
            
            for (let i = 0; i < offspringCount; i++) {
                const offsetDistance = 2 + this.dna.parentalCare * 3;
                const offsetX = (Math.random() - 0.5) * offsetDistance;
                const offsetY = (Math.random() - 0.5) * offsetDistance;
                const offsetZ = (Math.random() - 0.5) * offsetDistance;
                
                // 遺伝情報から子孫を生成
                const offspring = Lifeform.fromGeneticCode(
                    geneticCode,
                    this.position.x + offsetX,
                    this.position.y + offsetY,
                    this.position.z + offsetZ,
                    energyPerChild
                );
                
                lifeforms.push(offspring);
            }
        }
    }
    
    // 食物クラスを植物クラスに変更
    class Plant {
        constructor(x, y, z, energy, dna = null) {
            this.position = {
                x: x !== undefined ? x : Math.random() * width,
                y: y !== undefined ? y : height - 2 - Math.random() * 3,
                z: 0
            };
            this.energy = energy !== undefined ? energy : 0.3;
            this.age = 0;
            
            // DNAの初期化
            if (dna) {
                this.dna = dna;
            } else {
                this.dna = {
                    maxSize: Math.random() * 0.3 + 0.1,           // 最大サイズ (0.1-0.4)
                    growthRate: Math.random() * 0.8 + 0.2,        // 成長速度 (0.2-1.0)
                    photosynthesisEfficiency: Math.random() * 0.8 + 0.2, // 光合成効率 (0.2-1.0)
                    rootStrength: Math.random() * 0.8 + 0.2,      // 根の強さ (0.2-1.0)
                    maxHeight: Math.random() * 0.8 + 0.2,         // 最大高さの係数 (0.2-1.0)
                    reproductionRate: Math.random() * 0.8 + 0.2,  // 繁殖率 (0.2-1.0)
                    robustness: Math.random() * 0.8 + 0.2,        // 堅牢さ (0.2-1.0)
                    redPigment: Math.random() * 0.5,              // 赤色素の量 (0-0.5)
                    oxygenProduction: Math.random() * 0.8 + 0.2,  // 酸素生成効率 (0.2-1.0)
                    co2Consumption: Math.random() * 0.8 + 0.2     // CO2消費効率 (0.2-1.0)
                };
            }
            
            // DNAに基づいてパラメータを設定
            this.maxAge = 1500 + Math.floor(this.dna.robustness * 1000);
            this.size = 0.05;
            this.maxSize = 0.1 + this.dna.maxSize * 0.3;
            this.reproductionThreshold = 0.5 + this.dna.reproductionRate * 0.2;
            this.lastReproductionTime = 0;
            this.height = 0;
            this.maxHeight = 50 + this.dna.maxHeight * 150;
            this.growthHeight = 0;
            this.maxGrowthHeight = 40 + this.dna.maxHeight * 110;
            
            // 光効率関連のパラメータを追加
            this.lightEfficiency = 0.7 + this.dna.photosynthesisEfficiency * 0.6;
            this.heightEfficiencyBonus = 0.01 + this.dna.photosynthesisEfficiency * 0.02;
            this.maxHeightBonus = 2.0 + this.dna.photosynthesisEfficiency * 2.0;
            
            // 物理特性を更新
            this.mass = this.size * 0.8 + 0.2;
            this.buoyancy = this.size * 0.4 + 0.1;
            this.dragCoefficient = 0.2;
            this.rootStrength = 0.1 + this.dna.rootStrength * 0.4;
            
            this.velocity = { x: 0, y: 0, z: 0 };
            this.acceleration = { x: 0, y: 0, z: 0 };
            
            // 健康状態と毒素ダメージ
            this.health = 1.0;
            this.toxicDamage = 0;
            this.densityStress = 0;
            this.maxDensityStress = 0.8;
            this.densityRecoveryRate = 0.002;
            
            // 沈殿状態の追跡
            this.isSinking = false;
            this.initialEnergy = this.energy;
            this.initialSize = this.size;
            
            // 世代カウンター
            this.generation = 0;
        }
        
        // 捕食ダメージを受ける関数を追加
        takeDamage(amount) {
            this.health -= amount;
            this.size = Math.max(0.1, this.size * (this.health / this.maxHealth));
            return this.health <= 0;
        }
        
        applyPhysics() {
            // 沈殿中は通常の物理演算を適用
            if (this.isSinking) {
                // より強い重力
                const gravity = 0.015 * this.mass;
                
                // 弱い浮力
                const depth = this.position.y / height;
                const buoyancyForce = -0.005 * this.buoyancy * (depth + 0.2);
                
                // 水の抵抗
                const dragForce = {
                    x: -this.velocity.x * this.dragCoefficient,
                    y: -this.velocity.y * this.dragCoefficient,
                    z: 0
                };
                
                // 合力を適用
                this.acceleration.y += gravity + buoyancyForce;
                this.acceleration.x += dragForce.x;
                this.acceleration.y += dragForce.y;
                
                // 底面に到達したかチェック
                if (this.position.y >= height - 5) {
                    this.isSinking = false;
                    this.position.y = height - 1 - Math.random() * 2; // より底面に近く配置
                    this.velocity = { x: 0, y: 0, z: 0 }; // 速度をリセット
                }
            } else {
                // 通常の植物の物理演算（既存のコード）
                const gravity = 0.012 * this.mass;
                const depth = this.position.y / height;
                const buoyancyForce = -0.008 * this.buoyancy * (depth + 0.2);
                
                const dragForce = {
                    x: -this.velocity.x * this.dragCoefficient,
                    y: -this.velocity.y * this.dragCoefficient,
                    z: 0
                };
                
                // 根付きの効果
                const distanceFromBottom = Math.max(0, height - this.position.y);
                if (distanceFromBottom < 5) { // 15から5に変更
                    const rootingForce = -this.velocity.y * this.rootStrength * (1 - distanceFromBottom / 5);
                    dragForce.y += rootingForce;
                }
                
                this.acceleration.y += gravity + buoyancyForce;
                this.acceleration.x += dragForce.x;
                this.acceleration.y += dragForce.y;
            }
        }
        
        update(plants, oxygens, co2s, toxicMatters) {
            if (this.isSinking) {
                // 沈殿中は単純な物理演算のみ
                this.applyPhysics();
                
                // 速度を更新
                this.velocity.x += this.acceleration.x;
                this.velocity.y += this.acceleration.y;
                this.velocity.z += this.acceleration.z;
                
                // 位置を更新
                this.position.x += this.velocity.x;
                this.position.y += this.velocity.y;
                this.position.z += this.velocity.z;
                
                // 加速度をリセット
                this.acceleration = { x: 0, y: 0, z: 0 };
                
                // 底面到達時に植物として活性化
                if (this.position.y >= height - 15) {
                    this.isSinking = false;
                    this.position.y = height - 5 - Math.random() * 10;
                    this.velocity = { x: 0, y: 0, z: 0 };
                    this.energy = this.initialEnergy;
                    this.size = this.initialSize;
                    this.age = 0; // 植物としての寿命を開始
                }
                
                return false; // 沈殿中は死亡判定を行わない
            }
            
            this.age++;
            
            // 密度ストレスの処理
            const densityInfo = this.checkDensity(plants);
            this.densityStress = Math.min(this.maxDensityStress, 
                                         this.densityStress + densityInfo.densityStressIncrease);
            
            // 密度ストレスからの自然回復（周囲の密度が低い場合）
            if (densityInfo.nearbyPlants <= 1 && densityInfo.totalSize < this.maxSize) {
                this.densityStress = Math.max(0, this.densityStress - this.densityRecoveryRate);
            }
            
            // 密度ストレスの影響
            if (this.densityStress > 0) {
                // 1. 光合成効率の低下
                const densityPhotosynthesisPenalty = Math.max(0.3, 1 - this.densityStress);
                
                // 2. 成長速度の低下
                const densityGrowthPenalty = Math.max(0.2, 1 - this.densityStress);
                
                // 3. エネルギー消費の増加（競争によるストレス）
                this.energy -= this.densityStress * 0.002;
                
                // 4. 健康度への影響（長期的な密度ストレス）
                if (this.densityStress > 0.5) {
                    this.health = Math.max(0.1, this.health - (this.densityStress - 0.5) * 0.001);
                }
                
                // 5. 極端な密度ストレスの場合、萎縮を促進
                if (this.densityStress > 0.7) {
                    const shrinkRate = 0.0001 * (this.densityStress - 0.7) * 10;
                    this.size = Math.max(0.05, this.size - shrinkRate);
                    
                    if (this.growthHeight > 1) {
                        this.growthHeight = Math.max(1, this.growthHeight - shrinkRate * 5);
                    }
                }
            }
            
            // 上方向への成長速度を調整
            if (this.energy > 0.4 && this.growthHeight < this.maxGrowthHeight) {  // エネルギー閾値を0.3から0.4に増加
                const heightGrowthRate = 0.005 * this.dna.growthRate;  // 成長速度を遺伝子に基づいて調整
                this.growthHeight += heightGrowthRate;
                this.energy -= heightGrowthRate * 0.2;  // エネルギー消費を0.1から0.2に増加

                // 上方向に新しい植物を生成する確率を調整
                if (Math.random() < 0.002 * this.dna.reproductionRate && plants.length < maxLifeforms * 2) {  // 繁殖率に基づいて調整
                    // 親の遺伝子コードを取得
                    const parentGeneticCode = this.getGeneticCode();
                    
                    // 子の遺伝子コードを生成（変異を適用）
                    const childGeneration = this.generation + 1;
                    const stability = this.dna.robustness; // 堅牢さが高いほど変異が少ない
                    const childGeneticCode = Plant.mutateGeneticCode(parentGeneticCode, childGeneration, stability);
                    
                    const newPlant = Plant.fromGeneticCode(
                        childGeneticCode,
                        this.position.x + (Math.random() - 0.5) * 2,
                        this.position.y - this.growthHeight,
                        0,
                        0.4
                    );
                    newPlant.generation = childGeneration;
                    plants.push(newPlant);
                }
            }
            
            // 光合成と酸素生成（CO2を考慮）
            let co2Available = false;
            let consumedCO2 = 0;
            
            // 現在位置のCO2を消費
            const currentCO2 = getCO2At(this.position.x, this.position.y);
            
            if (currentCO2 > 0) {
                consumedCO2 = Math.min(currentCO2, 0.005 * this.dna.co2Consumption);  // CO2消費効率に基づいて調整
                changeCO2At(this.position.x, this.position.y, -consumedCO2);
                co2Available = true;
            }
            
            // CO2の有無で光合成効率が変化
            const photosynthesisRate = co2Available ? 
                0.002 * this.dna.photosynthesisEfficiency : 
                0.0005 * this.dna.photosynthesisEfficiency;  // 光合成効率に基づいて調整
            this.energy += photosynthesisRate * (1 + consumedCO2 * 30);  // 係数を50から30に減少
            
            // 酸素を生成（CO2消費量に応じて生成量が増加）
            if (this.energy > 0.4 && Math.random() < 0.2) {  // エネルギー閾値を0.3から0.4に増加、確率を0.3から0.2に減少
                const oxygenAmount = oxygenProductionRate * this.size * 
                    (1 + this.growthHeight / 5) * 
                    (1 + consumedCO2 * 50) * 
                    this.dna.oxygenProduction;  // 酸素生成効率に基づいて調整
                
                // 植物の周囲に酸素を放出
                for (let i = 0; i < 2; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const distance = 2 + Math.random() * 3;
                    const offsetX = Math.cos(angle) * distance;
                    const offsetY = Math.sin(angle) * distance;
                    
                    changeOxygenAt(
                        this.position.x + offsetX,
                        this.position.y - this.growthHeight + offsetY,
                        oxygenAmount * (0.8 + Math.random() * 0.4)
                    );
                }
            }
            
            // 成長処理を遅く
            if (this.size < this.maxSize && this.energy > 0.4) {  // エネルギー閾値を0.3から0.4に増加
                const growthRate = 0.00005;  // 0.0001から0.00005に減少
                this.size += growthRate;
                this.energy -= growthRate * 0.4;  // エネルギー消費を0.3から0.4に増加
            }
            
            // エネルギー消費を調整（より高い成長を維持できるように）
            this.energy -= 0.00015 * this.size;  // 0.0001から0.00015に増加
            
            // 物理演算を適用
            this.applyPhysics();
            
            // 速度と位置の更新（ただし、根付いた後は横方向の移動のみ）
            this.velocity.x += this.acceleration.x;
            this.velocity.y += this.acceleration.y;
            this.position.x += this.velocity.x;
            
            // 加速度をリセット
            this.acceleration = { x: 0, y: 0, z: 0 };
            
            // 体力回復も遅く
            if (this.health < this.maxHealth) {
                this.health = Math.min(this.maxHealth, this.health + 0.0002);  // 0.0005から0.0002に減少
                this.size = Math.max(0.1, this.size * (this.health / this.maxHealth));
            }
            
            // 周囲の植物の密度をチェック
            let nearbyPlants = 0;
            const densityCheckRadius = 4; // 5から4に減少（より狭い範囲でチェック）
            let totalSize = 0; // 周囲の植物の合計サイズを追跡
            
            for (const other of plants) {
                if (other === this) continue;
                
                const dx = this.position.x - other.position.x;
                const dy = this.position.y - other.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < densityCheckRadius) {
                    nearbyPlants++;
                    totalSize += other.size; // 周囲の植物のサイズを合計
                }
            }

            // 密度が高すぎる場合、植物は枯れて死骸になる
            // 条件を厳しく：植物の数だけでなく、サイズも考慮
            if ((nearbyPlants > 2 && this.size > this.maxSize * 0.6) || // 2以上の近接植物がいる場合
                (totalSize > this.maxSize * 1.5) || // 周囲の植物の合計サイズが大きすぎる場合
                (nearbyPlants > 1 && this.energy < 0.3)) { // 低エネルギー状態で密集している場合
                // 植物の死骸を生成
                const debris = new PlantDebris(
                    this.position.x,
                    this.position.y,
                    0,
                    this.size * 0.8
                );
                plantDebris.push(debris);
                return true; // 植物を除去
            }
            
            return this.age >= this.maxAge || this.energy <= 0 || this.health <= 0;
        }
        
        reproduce(plants) {
            const reproductionCost = 0.4;
            if (time - this.lastReproductionTime < 100) return;
            this.energy -= reproductionCost;
            this.lastReproductionTime = time;
            
            // 親の遺伝子コードを取得
            const parentGeneticCode = this.getGeneticCode();
            
            // 子の遺伝子コードを生成（変異を適用）
            const childGeneration = this.generation + 1;
            const stability = this.dna.robustness; // 堅牢さが高いほど変異が少ない
            const childGeneticCode = Plant.mutateGeneticCode(parentGeneticCode, childGeneration, stability);
            
            // 繁殖方向をランダムに選択（横または上）
            const isVerticalGrowth = Math.random() < 0.1; // 20%から10%に減少（上方向への成長をさらに抑制）
            
            if (isVerticalGrowth && this.position.y > height * 0.7) { // 下層70%以下でのみ上方向に成長可能
                // 上方向への繁殖距離を短く
                const newPlant = Plant.fromGeneticCode(
                    childGeneticCode,
                    this.position.x + (Math.random() - 0.5) * 2,
                    Math.max(this.position.y - 3 - Math.random() * 3, height * 0.7), // 下層70%より上には行かない
                    0,
                    0.4
                );
                newPlant.generation = childGeneration;
                plants.push(newPlant);
            } else {
                // 横方向への繁殖（複数の子孫を生成）
                const spreadCount = 1 + Math.floor(Math.random() * 2); // 1-2個の子孫
                for (let i = 0; i < spreadCount; i++) {
                    const spreadDistance = 5 + this.size * 5;
                    const offsetX = (Math.random() - 0.5) * spreadDistance;
                    
                    // 子孫ごとに異なる変異を適用
                    const uniqueChildGeneticCode = Plant.mutateGeneticCode(parentGeneticCode, childGeneration, stability);
                    
                    const newPlant = Plant.fromGeneticCode(
                        uniqueChildGeneticCode,
                        this.position.x + offsetX,
                        Math.min(this.position.y + (Math.random() - 0.5) * 2, height - 1), // 底面より下には行かない
                        0,
                        0.4
                    );
                    newPlant.generation = childGeneration;
                    plants.push(newPlant);
                }
            }
        }

        // 毒素との相互作用をチェックするメソッドを追加
        checkToxicInteraction(toxicMatters) {
            let totalDamage = 0;
            const toxicRadius = 5; // 毒素の影響範囲

            for (const toxic of toxicMatters) {
                if (toxic.decompositionStage !== 0) continue; // 未分解の毒素のみ影響を与える

                const dx = this.position.x - toxic.position.x;
                const dy = this.position.y - toxic.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < toxicRadius) {
                    // 距離に応じた毒素の影響を計算
                    const toxicEffect = (toxic.toxicity * 0.03) * (1 - distance / toxicRadius);
                    // 植物の毒素耐性に基づいてダメージを軽減
                    totalDamage += toxicEffect * (1 - this.toxicResistance);
                }
            }

            return totalDamage;
        }

        // 植物の色計算を修正して毒素の影響を表現
        getPlantColor(plant, healthFactor = 1) {
            // 基本色相（サイズに応じて緑の色調を変化）
            let hue = 80 + (plant.size / plant.maxSize) * 20;
            
            // 遺伝子による色の変化（赤色素の量に応じて色相を変化）
            const redTint = plant.dna.redPigment * 60; // 赤色素が多いほど赤みがかる
            hue = Math.max(40, hue - redTint); // 赤色素が多いと黄色〜赤色に近づく
            
            // 高さによる色相の変化（高いほど鮮やかな緑に）
            const heightRatio = plant.growthHeight / plant.maxGrowthHeight;
            hue += heightRatio * 10;
            
            // 密度ストレスによる色相の変化（密度ストレスが高いと紫がかる）
            if (plant.densityStress > 0.3) {
                const purpleTint = (plant.densityStress - 0.3) / 0.7 * 30;
                hue = Math.max(70, hue - purpleTint);
            }
            
            // 年齢による色相の変化（老化すると黄色みが増す）
            if (plant.age > plant.maxAge * 0.7) {
                const agingFactor = (plant.age - plant.maxAge * 0.7) / (plant.maxAge * 0.3);
                hue = Math.max(60, hue - agingFactor * 20);  // 老化すると黄色に近づく
            }
            
            // エネルギー不足による色相の変化（エネルギーが少ないと茶色っぽくなる）
            if (plant.energy < 0.3) {
                const energyDeficit = (0.3 - plant.energy) / 0.3;
                hue = Math.max(40, hue - energyDeficit * 30);  // エネルギー不足で茶色に
            }
            
            // 毒素の影響で色相を黄色や茶色に変化
            if (plant.toxicDamage > 0) {
                hue = Math.max(40, hue - plant.toxicDamage * 40); // 毒素が多いほど黄色や茶色に
            }
            
            // エネルギーと健康状態に基づく彩度（%表記）
            let saturation = (0.6 + (plant.energy * 0.3)) * 100; // 彩度のベースを0.7から0.6に下げる
            saturation *= healthFactor;
            
            // 堅牢さに基づく彩度の調整（堅牢さが高いほど彩度が高い）
            saturation *= (0.7 + plant.dna.robustness * 0.4); // 係数を0.8から0.7に下げる
            saturation = Math.min(90, saturation); // 彩度の上限を100%から90%に下げる
            
            // 光合成効率に基づく明度の調整（効率が高いほど明るい）（%表記）
            let lightness = (0.25 + (plant.dna.photosynthesisEfficiency * 0.25)) * 100; // 明度の範囲を下げる（0.3-0.3から0.25-0.25に変更）
            
            // 健康状態による明度の調整
            lightness *= healthFactor;
            lightness = Math.min(60, lightness); // 明度の上限を80%から60%に下げる
            
            // 不透明度の設定
            const opacity = 70 + plant.energy * 20; // 不透明度のベースを80%から70%に下げる
            
            // HSLAフォーマットで返す
            return `hsla(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(lightness)}%, ${opacity}%)`;
        }

        // 周囲の植物密度をチェックするメソッド
        checkDensity(plants) {
            const densityRadius = 5;  // 密度チェックの半径
            let nearbyPlants = 0;
            let totalSize = 0;
            
            for (const otherPlant of plants) {
                if (otherPlant === this) continue;
                
                const dx = this.position.x - otherPlant.position.x;
                const dy = this.position.y - otherPlant.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < densityRadius) {
                    nearbyPlants++;
                    totalSize += otherPlant.size;
                    
                    // 高さが近い植物ほどストレスが大きい（光の競合）
                    const heightDifference = Math.abs(this.growthHeight - otherPlant.growthHeight);
                    if (heightDifference < 5) {
                        totalSize += otherPlant.size * (1 - heightDifference / 5);
                    }
                }
            }
            
            // 密度ストレスの計算
            let densityStressIncrease = 0;
            
            // 条件1: 近くの植物が多すぎる
            if (nearbyPlants > 2) {
                densityStressIncrease += 0.01 * (nearbyPlants - 2);
            }
            
            // 条件2: 総サイズが大きすぎる
            if (totalSize > this.maxSize * 1.5) {
                densityStressIncrease += 0.01 * (totalSize / (this.maxSize * 1.5) - 1);
            }
            
            // 条件3: エネルギーが少ない状態で植物が近くにある
            if (nearbyPlants > 0 && this.energy < 0.3) {
                densityStressIncrease += 0.01 * nearbyPlants * (0.3 - this.energy) / 0.3;
            }
            
            // 密度耐性による軽減
            densityStressIncrease *= (1 - this.densityTolerance);
            
            return {
                nearbyPlants,
                totalSize,
                densityStressIncrease
            };
        }

        // 遺伝子文字列を取得するメソッド
        getDNAString() {
            // 各パラメータを2桁の16進数に変換する関数
            const toHex = (value) => {
                // 0-1の値を0-255の範囲に変換して16進数に
                const hex = Math.floor(value * 255).toString(16).padStart(2, '0');
                return hex;
            };

            // DNAパラメータを文字列化
            const dnaString = 
                toHex(this.dna.maxSize) +
                toHex(this.dna.growthRate) +
                toHex(this.dna.photosynthesisEfficiency) +
                toHex(this.dna.rootStrength) +
                toHex(this.dna.maxHeight) +
                toHex(this.dna.reproductionRate) +
                toHex(this.dna.robustness) +
                toHex(this.dna.redPigment) +
                toHex(this.dna.oxygenProduction) +
                toHex(this.dna.co2Consumption);

            return dnaString;
        }

        // 文字列からDNAを復元する静的メソッド
        static fromDNAString(dnaString) {
            // 16進数の文字列を0-1の値に変換する関数
            const fromHex = (hex) => {
                return parseInt(hex, 16) / 255;
            };

            // DNAパラメータを2文字ずつ取り出して変換
            const dna = {
                maxSize: fromHex(dnaString.substr(0, 2)),
                growthRate: fromHex(dnaString.substr(2, 2)),
                photosynthesisEfficiency: fromHex(dnaString.substr(4, 2)),
                rootStrength: fromHex(dnaString.substr(6, 2)),
                maxHeight: fromHex(dnaString.substr(8, 2)),
                reproductionRate: fromHex(dnaString.substr(10, 2)),
                robustness: fromHex(dnaString.substr(12, 2)),
                redPigment: fromHex(dnaString.substr(14, 2)),
                oxygenProduction: fromHex(dnaString.substr(16, 2)),
                co2Consumption: fromHex(dnaString.substr(18, 2))
            };

            return dna;
        }

        // 遺伝子コードを取得するメソッド
        getGeneticCode() {
            return this.getDNAString();
        }

        // 遺伝子コードから植物を生成する静的メソッド
        static fromGeneticCode(geneticCode, x, y, z, energy) {
            const dna = Plant.fromDNAString(geneticCode);
            return new Plant(x, y, z, energy, dna);
        }

        // 遺伝子コードを変異させる静的メソッド
        static mutateGeneticCode(dnaString, generation, stability = 0.5) {
            const mutationRate = 0.05 * (1 - stability); // 基本変異率（安定性が低いほど高くなる）
            let mutatedDna = '';
            
            // 2文字ずつ処理（16進数のペア）
            for (let i = 0; i < dnaString.length; i += 2) {
                const genePair = dnaString.substr(i, 2);
                
                // 遺伝子の位置に基づく変異率の調整
                const positionFactor = 1 - (i / dnaString.length);
                const geneComplexity = parseInt(genePair, 16) / 255; // 遺伝子の複雑さ
                
                // 最終的な変異率の計算
                const finalMutationRate = mutationRate * 
                    positionFactor * // 位置による影響
                    (1 + generation * 0.01) * // 世代による影響
                    (1 - geneComplexity * 0.5); // 複雑さによる影響
                
                if (Math.random() < finalMutationRate) {
                    // 変異の強度を計算（0.8-1.2の範囲）
                    const mutationStrength = 0.8 + Math.random() * 0.4;
                    
                    // 16進数値を10進数に変換
                    let value = parseInt(genePair, 16);
                    
                    // 値を変異させる
                    value = Math.floor(value * mutationStrength);
                    value = Math.max(0, Math.min(255, value)); // 0-255の範囲に収める
                    
                    // 16進数に戻して2桁に整形
                    mutatedDna += value.toString(16).padStart(2, '0');
                } else {
                    mutatedDna += genePair;
                }
            }
            
            return mutatedDna;
        }
    }
    
    // 毒性物質クラスを追加
    class ToxicMatter {
        constructor(x, y, z, energy) {
            this.position = { x, y, z };
            this.velocity = { x: 0, y: 0.3, z: 0 };
            this.acceleration = { x: 0, y: 0, z: 0 };
            this.energy = energy;
            this.toxicity = 0.8;
            this.mass = 0.8;
            this.buoyancy = 0.15; // 浮力を低下（0.15のまま）
            this.dragCoefficient = 0.15;
            this.age = 0;
            this.maxAge = 2000;
            this.isSettled = false;
            this.settlingTime = 0;
            this.decompositionStage = 0;
            this.decompositionProgress = 0;
            this.bacteriaCount = 0;
            this.stackHeight = 0;
            
            this.targetDepth = height - 1;
            this.maxLocalDensity = 3;
            this.upwardMoveSpeed = 0.2; // 上方向への移動速度を低下（0.5から0.2に）
            this.layerHeight = 2;
            this.maxToxicDensity = 4;
            this.decompositionRate = 0.005;
            this.groundFriction = 0.95; // 地面との摩擦係数を追加
        }

        // 未分解毒素の密度をチェック
        checkToxicDensity(toxicMatters) {
            let localCount = 0;
            const checkRadius = 3;
            const currentLayer = Math.floor(this.position.y / this.layerHeight);
            
            for (const matter of toxicMatters) {
                if (matter === this || matter.decompositionStage !== 0) continue;
                
                const matterLayer = Math.floor(matter.position.y / this.layerHeight);
                if (matterLayer !== currentLayer) continue;
                
                const dx = this.position.x - matter.position.x;
                const dy = this.position.y - matter.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < checkRadius) {
                    localCount++;
                }
            }
            
            return localCount;
        }

        // 分解済み毒素の密度をチェックする関数を追加
        checkDecomposedDensity(toxicMatters) {
            let localCount = 0;
            const checkRadius = 3;
            const currentLayer = Math.floor(this.position.y / this.layerHeight);
            
            for (const matter of toxicMatters) {
                if (matter === this || matter.decompositionStage < 2) continue;
                
                const matterLayer = Math.floor(matter.position.y / this.layerHeight);
                if (matterLayer !== currentLayer) continue;
                
                const dx = this.position.x - matter.position.x;
                const dy = this.position.y - matter.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < checkRadius) {
                    localCount++;
                }
            }
            
            return localCount;
        }

        applyPhysics() {
            if (this.isSettled) {
                // 定着後は横方向の動きのみ減衰
                this.velocity.x *= this.groundFriction;
                this.velocity.y = 0;
                return;
            }

            // 重力の影響
            const gravity = 0.05;
            this.acceleration.y += gravity;

            // 浮力の影響（分解段階に応じて変化）
            let currentBuoyancy = this.buoyancy;
            if (this.decompositionStage > 0) {
                currentBuoyancy *= Math.max(0.1, 1 - (this.decompositionProgress * 0.5));
            }
            
            // 水面付近での特殊な浮力処理
            const surfaceMargin = 3;
            if (this.position.y < surfaceMargin) {
                const surfaceFactor = 1 - (this.position.y / surfaceMargin);
                currentBuoyancy *= (1 - surfaceFactor * 0.7); // 水面付近で浮力を70%まで減少
            }
            
            const buoyancyForce = -gravity * currentBuoyancy;
            this.acceleration.y += buoyancyForce;

            // 抵抗力
            const dragForce = {
                x: -this.velocity.x * this.dragCoefficient,
                y: -this.velocity.y * this.dragCoefficient
            };
            this.acceleration.x += dragForce.x;
            this.acceleration.y += dragForce.y;

            // 底面との衝突判定と堆積処理
            if (this.position.y >= height - 1) {
                this.position.y = height - 1;
                this.velocity.y = 0;
                this.acceleration.y = 0;
                
                // 堆積判定の改善
                const horizontalSpeed = Math.abs(this.velocity.x);
                if (horizontalSpeed < 0.01) {
                    this.settlingTime++;
                    // 分解段階に応じて定着時間を調整
                    const requiredSettlingTime = this.decompositionStage === 0 ? 30 : 20;
                    if (this.settlingTime > requiredSettlingTime) {
                        this.isSettled = true;
                        this.velocity.x = 0;
                    }
                } else {
                    // 動きが大きい場合は定着カウントをリセット
                    this.settlingTime = Math.max(0, this.settlingTime - 1);
                }
                
                // 地面との摩擦
                this.velocity.x *= this.groundFriction;
            }

            // 水面付近での特殊処理
            const waterSurfaceY = 2;
            if (this.position.y <= waterSurfaceY) {
                // 水面での張力効果
                const surfaceTension = 0.02;
                this.acceleration.y += surfaceTension;
                
                // 分解段階が進んでいる場合は水面下に沈みやすく
                if (this.decompositionStage > 0) {
                    this.acceleration.y += gravity * 0.5;
                }
                
                // 水面での横方向の動きを制限
                this.velocity.x *= 0.95;
            }

            // 側面との衝突判定（より自然な反発）
            if (this.position.x < 0) {
                this.position.x = 0;
                this.velocity.x = Math.abs(this.velocity.x) * 0.5;
                // 壁との摩擦を考慮
                this.velocity.y *= 0.9;
            } else if (this.position.x >= width) {
                this.position.x = width - 1;
                this.velocity.x = -Math.abs(this.velocity.x) * 0.5;
                // 壁との摩擦を考慮
                this.velocity.y *= 0.9;
            }
        }

        update(plants, toxicMatters) {
            this.age++;
            
            if (!this.isSettled) {
                this.applyPhysics();

                // 速度の更新（より制限的に）
                this.velocity.x = Math.max(-0.5, Math.min(0.5, this.velocity.x + this.acceleration.x));
                this.velocity.y = Math.max(-0.8, Math.min(0.8, this.velocity.y + this.acceleration.y));
                
                this.position.x += this.velocity.x;
                this.position.y += this.velocity.y;

                // 加速度をリセット
                this.acceleration.x = 0;
                this.acceleration.y = 0;
            } else {
                // 定着後の処理
                if (this.decompositionStage > 0) {
                    // 分解が進んだ物質は徐々に沈降
                    const sinkRate = 0.001 * this.decompositionProgress;
                    this.position.y = Math.min(height - 1, this.position.y + sinkRate);
                }

                // 局所密度チェックと位置調整（より穏やかに）
                const localCount = this.checkLocalDensity(toxicMatters);
                if (localCount > this.maxLocalDensity) {
                    // 横方向へのゆっくりとした移動
                    this.position.x += (Math.random() - 0.5) * 0.1;
                    this.position.x = Math.max(0, Math.min(width - 1, this.position.x));
                }
            }

            // バクテリアがいる場合のみ分解が進行
            if (this.settlingTime > 100 && this.bacteriaCount > 0) {
                if (this.decompositionStage === 0) {
                    this.decompositionStage = 1;
                }
                
                if (this.decompositionStage === 1) {
                    // バクテリアの数に応じて分解速度が変化（より速く）
                    const decompositionRate = this.decompositionRate * this.bacteriaCount;
                    this.decompositionProgress += decompositionRate;
                    this.toxicity = Math.max(0, this.toxicity - decompositionRate * 3);
                    
                    if (this.decompositionProgress >= 1) {
                        this.decompositionStage = 2;
                        // 完全分解時に確実に植物を生成
                        const newPlant = new Plant(
                            this.position.x + (Math.random() - 0.5) * 2,
                            this.position.y,
                            0,
                            this.energy * 0.4
                        );
                        newPlant.size = 0.05 + Math.random() * 0.1;
                        newPlant.maxSize = 0.2 + Math.random() * 0.3;
                        plants.push(newPlant);
                        return true;
                    }
                }
            }

            // 完全に分解された場合、周囲の堆積物の濃度をチェック
            if (this.decompositionStage === 2) {
                const localCount = this.checkDecomposedDensity(toxicMatters);
                const maxLocalCount = 5; // 最大堆積数
                
                if (localCount > maxLocalCount) {
                    // 堆積が多い場合、上に移動
                    const newY = this.position.y - 1;
                    if (newY > 0) { // 画面上端を超えないように
                        this.position.y = newY;
                        this.stackHeight++;
                    }
                }
            }
            
            // 堆肥化完了後、一定確率で植物を生成
            if (this.decompositionStage === 2 && Math.random() < 0.01 && this.position.y > height * 0.7) {
                const newPlant = new Plant(
                    this.position.x + (Math.random() - 0.5) * 2,
                    Math.min(this.position.y, height - 1), // 底面より下には行かない
                    0,
                    this.energy * 0.4
                );
                newPlant.size = 0.05 + Math.random() * 0.1;
                newPlant.maxSize = 0.2 + Math.random() * 0.3;
                plants.push(newPlant);
                return true;
            }

            // バクテリアカウントをリセット（毎フレーム）
            this.bacteriaCount = 0;

            // 堆積物の密度チェックと位置調整
            if (this.decompositionStage === 2) {
                const { count, lowestY } = this.checkLocalDensity(toxicMatters);
                
                if (count > this.maxLocalDensity) {
                    // 徐々に上昇（急激な変化を防ぐ）
                    const targetY = lowestY - 2;
                    if (this.position.y > targetY) {
                        this.position.y -= this.upwardMoveSpeed;
                        this.stackHeight = Math.floor((height - this.position.y) / 2);
                    }
                }
            }

            return this.age >= this.maxAge;
        }

        checkLocalDensity(toxicMatters) {
            let localCount = 0;
            const checkRadius = 3;
            let lowestY = this.position.y;
            
            for (const matter of toxicMatters) {
                if (matter === this || matter.decompositionStage !== 2) continue;
                
                const dx = this.position.x - matter.position.x;
                const dy = this.position.y - matter.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < checkRadius) {
                    localCount++;
                    lowestY = Math.max(lowestY, matter.position.y);
                }
            }
            
            return { count: localCount, lowestY: lowestY };
        }
    }
    
    // 浄化バクテリアクラスを追加
    class PurifierBacteria {
        constructor(x, y, z, dna = null) {
            this.position = {
                x: x !== undefined ? x : Math.random() * width,
                y: y !== undefined ? y : height - 2 - Math.random() * 3,
                z: z || 0
            };

            // 遺伝情報の初期化
            this.dna = dna || {
                // 基本的な特性
                speed: 0.2 + Math.random() * 0.2,
                efficiency: 0.5 + Math.random() * 0.3,
                purificationPower: 0.4 + Math.random() * 0.4,
                oxygenEfficiency: 0.5 + Math.random() * 0.3,
                oxygenTolerance: 0.4 + Math.random() * 0.4,
                reproductionRate: 0.1 + Math.random() * 0.2,
                size: 0.1 + Math.random() * 0.1,
                
                // 環境適応性
                depthPreference: Math.random(), // 0-1: 0が表層、1が深層を好む
                toxicResistance: 0.3 + Math.random() * 0.4,
                
                // 社会性
                cooperationFactor: Math.random(), // 他のバクテリアとの協調性
                territorialBehavior: Math.random() // 縄張り意識の強さ
            };

            // 世代と遺伝的安定性を追加
            this.generation = 1;
            this.ancestralStability = 1.0;

            this.energy = 0.5 + Math.random() * 0.3;
            this.age = 0;
            this.maxAge = 300 + Math.floor(Math.random() * 200);
            this.size = this.dna.size;
            this.velocity = { x: 0, y: 0, z: 0 };
            this.searchRadius = 20;
            this.currentTarget = null;
            this.oxygenReserve = 0.5;
            this.maxOxygenReserve = 1.0;
            this.oxygenConsumptionRate = 0.008;
            this.speed = this.dna.speed;
            this.purificationEfficiency = this.dna.purificationPower;
        }

        // DNAを文字列に変換するメソッド
        getDNAString() {
            const toHex = (value) => {
                return Math.floor(value * 255).toString(16).padStart(2, '0');
            };

            return Object.values(this.dna).map(toHex).join('');
        }

        // 文字列からDNAを復元する静的メソッド
        static fromDNAString(dnaString) {
            const fromHex = (hex) => {
                return parseInt(hex, 16) / 255;
            };

            const values = [];
            for (let i = 0; i < dnaString.length; i += 2) {
                values.push(fromHex(dnaString.substr(i, 2)));
            }

            return {
                speed: values[0],
                efficiency: values[1],
                purificationPower: values[2],
                oxygenEfficiency: values[3],
                oxygenTolerance: values[4],
                reproductionRate: values[5],
                size: values[6],
                depthPreference: values[7],
                toxicResistance: values[8],
                cooperationFactor: values[9],
                territorialBehavior: values[10]
            };
        }

        // 遺伝情報を取得
        getGeneticCode() {
            return {
                dnaString: this.getDNAString(),
                generation: this.generation || 1,
                ancestralStability: this.ancestralStability || 1.0
            };
        }

        // 遺伝情報から新しいバクテリアを生成する静的メソッド
        static fromGeneticCode(geneticCode, x, y, z, energy) {
            const dna = PurifierBacteria.fromDNAString(
                PurifierBacteria.mutateGeneticCode(
                    geneticCode.dnaString,
                    geneticCode.generation,
                    geneticCode.ancestralStability
                )
            );
            
            const offspring = new PurifierBacteria(x, y, z, dna);
            offspring.generation = geneticCode.generation + 1;
            offspring.ancestralStability = Math.max(0.1, geneticCode.ancestralStability * 0.995);
            offspring.energy = energy;
            
            return offspring;
        }

        // 遺伝情報に変異を加える静的メソッド
        static mutateGeneticCode(dnaString, generation, stability) {
            const mutationRate = 0.05 * (1 - stability);
            let mutatedDna = '';
            
            for (let i = 0; i < dnaString.length; i += 2) {
                const genePair = dnaString.substr(i, 2);
                const positionFactor = 1 - (i / dnaString.length);
                const geneComplexity = parseInt(genePair, 16) / 255;
                
                const finalMutationRate = mutationRate * 
                    positionFactor * 
                    (1 + generation * 0.01) * 
                    (1 - geneComplexity * 0.5);
                
                if (Math.random() < finalMutationRate) {
                    const mutationStrength = 0.8 + Math.random() * 0.4;
                    let value = parseInt(genePair, 16);
                    value = Math.floor(value * mutationStrength);
                    value = Math.max(0, Math.min(255, value));
                    mutatedDna += value.toString(16).padStart(2, '0');
                } else {
                    mutatedDna += genePair;
                }
            }
            
            return mutatedDna;
        }

        // 繁殖メソッドを更新
        reproduce() {
            if (bacteria.length >= bacteriaMaxCount) return false;

            const offspringCount = 1 + Math.floor(Math.random() * 2);
            const energyCost = this.energy * 0.4;
            const oxygenCost = this.oxygenReserve * 0.3;
            this.energy -= energyCost;
            this.oxygenReserve -= oxygenCost;

            const geneticCode = this.getGeneticCode();

            for (let i = 0; i < offspringCount; i++) {
                const spreadDistance = 3 + Math.random() * 2;
                const angle = Math.random() * Math.PI * 2;
                
                const offspring = PurifierBacteria.fromGeneticCode(
                    geneticCode,
                    this.position.x + Math.cos(angle) * spreadDistance,
                    this.position.y + Math.sin(angle) * spreadDistance,
                    0,
                    energyCost / offspringCount * 0.8
                );
                
                offspring.oxygenReserve = oxygenCost / offspringCount * 0.8;
                bacteria.push(offspring);
            }
            
            return false;
        }

        // 酸素を探して吸収する関数
        findAndConsumeOxygen(oxygens) {
            if (!oxygens || !oxygens.getOxygenAt || !oxygens.changeOxygenAt) return false;
            
            // 現在位置の酸素を消費
            const currentOxygen = oxygens.getOxygenAt(this.position.x, this.position.y);
            
            if (currentOxygen > 0) {
                const consumedAmount = Math.min(currentOxygen, 0.01);
                oxygens.changeOxygenAt(this.position.x, this.position.y, -consumedAmount);
                this.oxygenReserve = Math.min(this.maxOxygenReserve, this.oxygenReserve + consumedAmount * 0.8);
                return consumedAmount > 0;
            }
            
            return false;
        }

        update(toxicMatters, plants, oxygens) {
            if (!toxicMatters) toxicMatters = [];
            if (!plants) plants = [];
            if (!oxygens) {
                oxygens = {
                    getOxygenAt: function(x, y) { return 0.2; },
                    changeOxygenAt: function(x, y, amount) {}
                };
            }

            this.age++;

            // 基礎代謝によるエネルギー消費（効率に基づく）
            const baseMetabolism = 0.001 * (1 + this.size) * (1 - this.dna.efficiency * 0.5);
            this.energy -= baseMetabolism;

            // 移動によるエネルギー消費（速度と効率に基づく）
            const movementCost = Math.sqrt(
                this.velocity.x * this.velocity.x +
                this.velocity.y * this.velocity.y
            ) * 0.002 * (1 - this.dna.efficiency * 0.3);
            this.energy -= movementCost;

            // 酸素消費（効率に基づく）
            const baseOxygenConsumption = this.oxygenConsumptionRate * (1 - this.dna.oxygenEfficiency * 0.5);
            this.oxygenReserve = Math.max(0, this.oxygenReserve - baseOxygenConsumption);
            
            // 酸素を探して吸収（効率に基づく）
            if (oxygens && typeof oxygens.getOxygenAt === 'function') {
                const localOxygen = oxygens.getOxygenAt(this.position.x, this.position.y);
                if (localOxygen > 0) {
                    const consumedAmount = Math.min(localOxygen, 0.01 * this.dna.oxygenEfficiency);
                    oxygens.changeOxygenAt(this.position.x, this.position.y, -consumedAmount);
                    this.oxygenReserve = Math.min(this.maxOxygenReserve, 
                        this.oxygenReserve + consumedAmount * this.dna.oxygenEfficiency);
                }
            }
            
            // 酸素不足時は活動を制限
            const oxygenFactor = Math.min(1, this.oxygenReserve / 0.2);
            
            // 酸素不足によるダメージ（耐性に基づく）
            if (this.oxygenReserve < 0.1) {
                const oxygenDamage = 0.002 * (1 - this.oxygenReserve * 10) * (1 - this.dna.oxygenTolerance);
                this.energy -= oxygenDamage;
            }

            // 死亡条件をチェック
            if (this.energy <= 0 || this.age >= this.maxAge || this.oxygenReserve <= 0) {
                return true;
            }
            
            // 現在の対象がなければ新しい毒素を探す
            if (!this.currentTarget) {
                let closestDist = this.searchRadius * oxygenFactor;
                let closestToxic = null;

                for (const toxic of toxicMatters) {
                    if (toxic && toxic.isSettled && toxic.decompositionStage !== 2) {
                        const dx = this.position.x - toxic.position.x;
                        const dy = this.position.y - toxic.position.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        // 深度選好性に基づいて距離を調整
                        const depthFactor = Math.abs(this.dna.depthPreference - (toxic.position.y / height));
                        const adjustedDistance = distance * (1 + depthFactor);

                        if (adjustedDistance < closestDist) {
                            closestDist = adjustedDistance;
                            closestToxic = toxic;
                        }
                    }
                }

                if (closestToxic) {
                    this.currentTarget = closestToxic;
                }
            }

            // 対象が見つかった場合の処理
            if (this.currentTarget) {
                const dx = this.currentTarget.position.x - this.position.x;
                const dy = this.currentTarget.position.y - this.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 3) {
                    // 毒素の分解（浄化効率と毒素耐性に基づく）
                    this.currentTarget.bacteriaCount++;
                    const decompositionEfficiency = this.dna.purificationPower * 
                        (1 + this.dna.toxicResistance * 0.5);
                    
                    // 毒素による影響（耐性に基づく）
                    const toxicDamage = this.currentTarget.toxicity * 0.01 * 
                        (1 - this.dna.toxicResistance);
                    this.energy -= toxicDamage;
                    
                    // エネルギー獲得（効率に基づく）
                    const energyGain = 0.005 * decompositionEfficiency * this.dna.efficiency;
                    this.energy = Math.min(1.0, this.energy + energyGain);
                } else {
                    // 対象に向かって移動（速度と酸素状態に基づく）
                    const moveSpeed = this.dna.speed * oxygenFactor;
                    this.velocity.x = (dx / distance) * moveSpeed;
                    this.velocity.y = (dy / distance) * moveSpeed;
                }
            } else {
                // ランダムな移動（社会性に基づく）
                if (Math.random() < 0.05 * oxygenFactor) {
                    // 他のバクテリアとの相互作用を考慮
                    let socialForce = { x: 0, y: 0 };
                    let nearbyCount = 0;
                    
                    for (const other of bacteria) {
                        if (other === this) continue;
                        
                        const dx = other.position.x - this.position.x;
                        const dy = other.position.y - this.position.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance < 10) {
                            // 協調性と縄張り意識に基づく力を計算
                            const socialFactor = (this.dna.cooperationFactor - 
                                this.dna.territorialBehavior) / distance;
                            socialForce.x += dx * socialFactor;
                            socialForce.y += dy * socialFactor;
                            nearbyCount++;
                        }
                    }
                    
                    if (nearbyCount > 0) {
                        // 社会的な力を正規化して適用
                        const forceMagnitude = Math.sqrt(
                            socialForce.x * socialForce.x + 
                            socialForce.y * socialForce.y
                        );
                        if (forceMagnitude > 0) {
                            this.velocity.x = (socialForce.x / forceMagnitude) * this.dna.speed;
                            this.velocity.y = (socialForce.y / forceMagnitude) * this.dna.speed;
                        }
                    } else {
                        // 他のバクテリアが近くにいない場合はランダムな移動
                        this.velocity.x = (Math.random() - 0.5) * this.dna.speed;
                        this.velocity.y = (Math.random() - 0.5) * this.dna.speed;
                    }
                }
            }

            // 位置の更新と境界チェック
            this.position.x += this.velocity.x;
            this.position.y += this.velocity.y;
            
            // 水平方向の境界
            if (this.position.x < 0) {
                this.position.x = 0;
                this.velocity.x *= -0.5;
            } else if (this.position.x >= width) {
                this.position.x = width - 1;
                this.velocity.x *= -0.5;
            }
            
            // 垂直方向の境界（深度選好性に基づく）
            const preferredDepth = this.dna.depthPreference * height;
            const depthDifference = this.position.y - preferredDepth;
            this.velocity.y -= depthDifference * 0.001;

            // 繁殖判定（繁殖率に基づく）
            if (this.energy > 0.7 && Math.random() < this.dna.reproductionRate * 0.1) {
                this.reproduce();
            }
            
            return false;
        }
    }
    
    // 植物の死骸クラスを追加
    class PlantDebris {
        constructor(x, y, z, size) {
            this.position = { x, y, z };
            this.velocity = { x: 0, y: 0.1, z: 0 };
            this.acceleration = { x: 0, y: 0, z: 0 };
            this.size = size;
            this.mass = size * 0.8;
            this.buoyancy = size * 0.3;
            this.dragCoefficient = 0.2;
            this.age = 0;
            this.maxAge = 1000 + Math.floor(Math.random() * 500);
            this.decompositionProgress = 0;
            this.isSettled = false;
            this.anaerobicBacteriaCount = 0;
            this.isCompost = false;
            this.compostNutrientValue = 0;
            this.color = {
                hue: 30, // 茶色
                saturation: 60,
                lightness: 30,
                opacity: 70
            };
            this.stackHeight = 0; // 堆積の高さを追跡
            this.maxLocalDensity = 3; // 最大局所密度を定義
            this.upwardMoveSpeed = 0.5; // 上方向への移動速度
            this.decompositionRate = 0.003; // 基本分解速度を追加
            this.bacteriaEfficiency = 1.2; // バクテリアの効率係数を追加
        }

        // 周囲の堆肥の濃度をチェック
        checkCompostDensity(plantDebris) {
            let localCompostCount = 0;
            const checkRadius = 3;
            
            for (const debris of plantDebris) {
                if (debris === this || !debris.isCompost) continue;
                
                const dx = this.position.x - debris.position.x;
                const dy = this.position.y - debris.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < checkRadius) {
                    localCompostCount++;
                }
            }
            
            return localCompostCount;
        }

        applyPhysics() {
            if (this.isSettled) return;

            const gravity = 0.01 * this.mass;
            const depth = this.position.y / height;
            const buoyancyForce = -0.005 * this.buoyancy * (depth + 0.2);
            
            const dragForce = {
                x: -this.velocity.x * this.dragCoefficient,
                y: -this.velocity.y * this.dragCoefficient,
                z: 0
            };
            
            this.acceleration.y = gravity + buoyancyForce + dragForce.y;
            this.acceleration.x = dragForce.x;
            
            // 底面または堆積した堆肥との衝突判定
            if (this.position.y >= height - 2) {
                this.position.y = height - 1;
                this.velocity = { x: 0, y: 0, z: 0 };
                this.acceleration = { x: 0, y: 0, z: 0 };
                this.isSettled = true;
            }
        }

        update(bacteria, anaerobicBacteria, plantDebris) {
            this.age++;
            
            if (!this.isSettled) {
                this.applyPhysics();
                
                // 速度と位置の更新
                this.velocity.x += this.acceleration.x;
                this.velocity.y += this.acceleration.y;
                this.position.x += this.velocity.x;
                this.position.y += this.velocity.y;

                // 底面に到達したら定着
                if (this.position.y >= height - 2) {
                    this.position.y = height - 2;
                    this.isSettled = true;
                    this.velocity = { x: 0, y: 0, z: 0 };
                }
                
                return false;
            }

            // 好気性バクテリアと嫌気性バクテリアの両方による分解
            let totalDecomposition = 0;

            // 好気性バクテリアによる分解
            for (const bacterium of bacteria) {
                const dx = this.position.x - bacterium.position.x;
                const dy = this.position.y - bacterium.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 3) {
                    totalDecomposition += this.decompositionRate * this.bacteriaEfficiency;
                }
            }

            // 嫌気性バクテリアによる分解
            if (this.anaerobicBacteriaCount > 0) {
                totalDecomposition += this.decompositionRate * this.anaerobicBacteriaCount;
            }

            // 分解の進行
            if (totalDecomposition > 0) {
                this.decompositionProgress += totalDecomposition;
                
                // 色の更新（より暗い茶色へ）
                this.color.hue = 30;
                this.color.saturation = 40 + this.decompositionProgress * 20;
                this.color.lightness = Math.max(20, 30 - this.decompositionProgress * 10);
                this.color.opacity = Math.max(40, 70 - this.decompositionProgress * 20);
                
                // 完全に分解されたら堆肥に変換
                if (this.decompositionProgress >= 1 && !this.isCompost) {
                    this.isCompost = true;
                    this.compostNutrientValue = this.size * 0.7;
                    this.color = {
                        hue: 25,
                        saturation: 70,
                        lightness: 15,
                        opacity: 90
                    };
                    
                    // 一定確率で新しい植物を生成（位置を調整）
                    if (Math.random() < 0.3) {
                        const newPlant = new Plant(
                            this.position.x + (Math.random() - 0.5) * 2,
                            height - 1, // 必ず底面に生成
                            0,
                            0.3
                        );
                        newPlant.size = 0.05 + Math.random() * 0.1;
                        newPlant.maxSize = 0.2 + Math.random() * 0.3;
                        plants.push(newPlant);
                    }
                }
            }

            // カウントをリセット
            this.anaerobicBacteriaCount = 0;

            // 堆積物の密度チェックと位置調整（より制限的に）
            if (this.isCompost) {
                const localCompostCount = this.checkCompostDensity(plantDebris);
                if (localCompostCount > this.maxLocalDensity) {
                    // より制限的な上方移動
                    const newY = this.position.y - 0.05; // 移動速度をさらに減少
                    if (newY >= height - 3) { // 底面からの最大移動範囲を制限
                        this.position.y = newY;
                    } else {
                        this.position.y = height - 3; // 最大移動高度を制限
                    }
                }
            } else {
                // 非堆肥状態では底面に留まる
                this.position.y = height - 1;
            }

            return this.age >= this.maxAge;
        }

        checkLocalDensity(plantDebris) {
            let localCount = 0;
            const checkRadius = 3;
            let lowestY = this.position.y;
            
            for (const debris of plantDebris) {
                if (debris === this) continue;
                
                const dx = this.position.x - debris.position.x;
                const dy = this.position.y - debris.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < checkRadius) {
                    localCount++;
                    lowestY = Math.max(lowestY, debris.position.y);
                }
            }
            
            return { count: localCount, lowestY: lowestY };
        }
    }
    
    // 生命体と植物の初期化
    const lifeforms = [];
    const plants = [];
    const toxicMatters = [];
    const bacteria = [];
    const plantDebris = [];
    const anaerobicBacteria = [];
    
    // 基準となる初期DNAを定義
    const initialDNA = {
        speed: 0.45,          // 中央値を使用
        efficiency: 0.65,     // 中央値を使用
        perception: 0.6,      // 中央値を使用
        foodAttraction: 0.75, // 中央値を使用
        socialBehavior: 0,    // 中立的な値を使用
        reproductionRate: 0.25, // 中央値を使用
        predatory: 0.3,       // やや低めの捕食性
        size: 0.4,           // 中央値を使用
        
        // 向光性（光に対する反応）
        phototropism: 0.3,    // やや向光性（正の値）
        
        // Boidの動きに関する特性
        separationWeight: 0.85,
        alignmentWeight: 0.35,
        cohesionWeight: 0.2,
        
        // 繁殖戦略
        offspringCount: 2,    // 固定値
        parentalCare: 0.5,    // 中央値を使用
        
        // 特殊能力
        regenerationRate: 0.05, // 中央値を使用
        toxicity: 0.25,      // 中央値を使用
        
        // 酸素関連の特性
        oxygenEfficiency: 0.65,
        oxygenTolerance: 0.5
    };
    
    // 初期生命体を同一DNAで生成
    for (let i = 0; i < initialLifeCount; i++) {
        const x = Math.random() * width;
        const y = height * (0.2 + Math.random() * 0.6);
        lifeforms.push(new Lifeform(x, y, 0, 0.9, {...initialDNA}));  // DNAをコピーして使用
    }
    
    // 植物の初期生成を調整
    const initialPlantCount = Math.floor(width * 0.3); // 0.5から0.3に減少
    for (let i = 0; i < initialPlantCount; i++) {
        // より均一に分布するように配置
        const x = (i / initialPlantCount) * width + (Math.random() - 0.5) * 10; // 少しランダム性を持たせる
        const y = height - 1 - Math.random() * 2; // より底面に近く、薄い層に
        
        // 初期の植物をより小さく、成長の余地を持たせる
        const plant = new Plant(x, y, 0, 0.5);
        plant.size = 0.05 + Math.random() * 0.1; // より小さな初期サイズ
        plant.maxSize = 0.2 + Math.random() * 0.3; // 最大サイズも抑えめに
        plants.push(plant);
    }
    
    // Z-bufferを初期化
    function initZBuffer() {
        const buffer = [];
        for (let i = 0; i < width * height; i++) {
            buffer.push({
                char: ' ',
                depth: Infinity,
                color: ''
            });
        }
        return buffer;
    }
    
    // 生命体の色計算を元に戻す
    function getColor(lifeform) {
        // 基本色相（捕食者か被食者かで異なる）
        const hue = lifeform.baseHue;
        
        // エネルギーレベルに基づく彩度
        const saturation = 50 + lifeform.energy * 50;  // 元の値に戻す
        
        // 年齢に基づく明度（若いほど明るい）
        const ageRatio = Math.min(1, lifeform.age / maxAge);
        const lightness = 70 - ageRatio * 40;  // 元の値に戻す
        
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;  // 不透明度は使用しない
    }
    
    // 植物の色計算を修正
    function getPlantColor(plant, healthFactor = 1) {
        return plant.getPlantColor(plant, healthFactor);
    }
    
    // フレームを描画
    function render() {
        const zBuffer = initZBuffer();
        
        // バクテリアを更新
        for (let i = bacteria.length - 1; i >= 0; i--) {
            if (!bacteria[i]) continue; // undefinedチェックを追加
            
            // oxygensパラメータとして酸素マップを渡す
            if (bacteria[i].update(toxicMatters || [], plants || [], {
                getOxygenAt: getOxygenAt || function(x, y) { return 0.2; },
                changeOxygenAt: changeOxygenAt || function(x, y, amount) {}
            })) {
                bacteria.splice(i, 1);
            }
        }
        
        // 植物を更新
        for (let i = plants.length - 1; i >= 0; i--) {
            if (plants[i].update(plants, null, null)) { // oxygens, co2s引数を削除
                plants.splice(i, 1);
            }
        }
        
        // 生命体を更新
        for (let i = lifeforms.length - 1; i >= 0; i--) {
            if (!lifeforms[i]) continue; // undefinedチェックを追加
            
            lifeforms[i].update(lifeforms || [], plants || [], toxicMatters || [], anaerobicBacteria);  // anaerobicBacteriaを追加
            
            if (lifeforms[i].isDead) {
                // 死亡時、その場所に毒性物質を生成
                const deadLifeform = lifeforms[i];
                if (deadLifeform && deadLifeform.position) {
                    const toxicMatter = new ToxicMatter(
                        deadLifeform.position.x,
                        deadLifeform.position.y,
                        0,
                        deadLifeform.energy * 0.5
                    );
                    if (toxicMatters) toxicMatters.push(toxicMatter);

                    // 死亡した生命体から一定確率でバクテリアを生成
                    if (Math.random() < 0.25 && bacteria) {
                        const bacteriaCount = 1 + Math.floor(Math.random() * 2);
                        for (let j = 0; j < bacteriaCount; j++) {
                            const bacterium = new PurifierBacteria(
                                deadLifeform.position.x + (Math.random() - 0.5) * 3,
                                deadLifeform.position.y + (Math.random() - 0.5) * 3,
                                0
                            );
                            bacterium.energy = 0.6;
                            bacteria.push(bacterium);
                        }
                    }
                }
                lifeforms.splice(i, 1);
            }
        }
        
        // 毒性物質を更新
        for (let i = toxicMatters.length - 1; i >= 0; i--) {
            if (!toxicMatters[i]) continue; // undefinedチェックを追加
            
            // 毒性物質から一定確率で新しいバクテリアを生成
            if (toxicMatters[i].isSettled && Math.random() < 0.01 && bacteria) {
                const bacterium = new PurifierBacteria(
                    toxicMatters[i].position.x + (Math.random() - 0.5) * 2,
                    toxicMatters[i].position.y + (Math.random() - 0.5) * 2,
                    0
                );
                bacterium.energy = 0.5;
                bacteria.push(bacterium);
            }

            if (toxicMatters[i].update(plants || [], toxicMatters || [])) {
                toxicMatters.splice(i, 1);
            }
        }
        
        // 嫌気性バクテリアを更新
        for (let i = anaerobicBacteria.length - 1; i >= 0; i--) {
            if (anaerobicBacteria[i].update(plantDebris, null)) { // oxygens引数を削除
                anaerobicBacteria.splice(i, 1);
            }
        }
        
        // 植物の死骸を更新
        for (let i = plantDebris.length - 1; i >= 0; i--) {
            if (plantDebris[i].update(bacteria, anaerobicBacteria, plantDebris)) {
                plantDebris.splice(i, 1);
            }
        }
        
        // ガスの拡散処理
        diffuseGases();
        
        // 植物を描画
        for (const plant of plants) {
            // 根本の位置を描画
            const baseX = Math.floor(plant.position.x);
            const baseY = Math.floor(plant.position.y);

            // 成長した高さに応じて上方向に描画
            for (let h = 0; h <= plant.growthHeight; h++) {
                const projectedX = baseX;
                const projectedY = baseY - h;
                const z = plant.position.z;

                if (projectedX >= 0 && projectedX < width && 
                    projectedY >= 0 && projectedY < height) {
                    const bufferIndex = projectedY * width + projectedX;

                    if (z < zBuffer[bufferIndex].depth) {
                        // 高さに応じて文字を変える
                        const isTop = h === Math.floor(plant.growthHeight);
                        const sizeIndex = Math.floor(plant.size * asciiChars.length);
                        let displayChar = isTop ? 
                            asciiChars[Math.min(sizeIndex, asciiChars.length - 1)] :
                            '│';  // 茎を表現

                        // 体力に応じて色を調整
                        const healthFactor = plant.health !== undefined ? plant.health : 1.0;
                        const color = getPlantColor(plant, healthFactor);

                        zBuffer[bufferIndex] = {
                            char: displayChar,
                            depth: z,
                            color: color
                        };
                    }
                }
            }
        }
        
        // 生命体を描画
        for (const lifeform of lifeforms) {
            const projectedX = Math.floor(lifeform.position.x);
            const projectedY = Math.floor(lifeform.position.y);
            const z = lifeform.position.z;
            
            if (projectedX >= 0 && projectedX < width && projectedY >= 0 && projectedY < height) {
                const bufferIndex = projectedY * width + projectedX;
                
                if (z < zBuffer[bufferIndex].depth) {
                    // エネルギーと年齢に基づいて文字を選択
                    const energyIndex = Math.min(
                        Math.floor(lifeform.energy * (asciiChars.length - 1)),
                        asciiChars.length - 1
                    );
                    
                    // 捕食者は大きめの文字、被食者は小さめの文字で表示
                    let displayChar = asciiChars[energyIndex];
                    if (lifeform.isPredator) {
                        // 捕食者は大きめの文字（エネルギーが高いほど大きい）
                        displayChar = asciiChars[Math.min(energyIndex, asciiChars.length - 2)];
                    } else {
                        // 被食者は小さめの文字
                        displayChar = asciiChars[Math.max(energyIndex, 2)];
                    }
                    
                    zBuffer[bufferIndex] = {
                        char: displayChar,
                        depth: z,
                        color: getColor(lifeform)
                    };
                }
            }
        }
        
        // 酸素を描画
        for (let x = 0; x < gridWidth; x++) {
            for (let y = 0; y < gridHeight; y++) {
                const oxygenLevel = oxygenMap[x][y];
                
                if (oxygenLevel > 0.03) {
                    // グリッドの中心座標を計算
                    const centerX = x * gridSize + gridSize / 2;
                    const centerY = y * gridSize + gridSize / 2;
                    
                    // グリッド内のランダムな位置に酸素を表示
                    const offsetX = (Math.random() - 0.5) * gridSize;
                    const offsetY = (Math.random() - 0.5) * gridSize;
                    
                    const projectedX = Math.floor(centerX + offsetX);
                    const projectedY = Math.floor(centerY + offsetY);
                    
                    if (projectedX >= 0 && projectedX < width && 
                        projectedY >= 0 && projectedY < height) {
                        const bufferIndex = projectedY * width + projectedX;
                        
                        // 酸素濃度に応じて表示を変える
                        let displayChar, opacity, lightness, saturation;
                        
                        displayChar = oxygenLevel > 0.7 ? '◦' : 
                                    oxygenLevel > 0.4 ? '·' : 
                                    '·';
                        opacity = 20 + oxygenLevel * 20; // 不透明度を20-40%に
                        lightness = 60 + oxygenLevel * 10; // 明るさを60-70%に
                        saturation = 60; // 彩度を60%に
                        
                        zBuffer[bufferIndex] = {
                            char: displayChar,
                            depth: -1, // 酸素は最背面に表示
                            color: `hsla(190, ${saturation}%, ${lightness}%, ${opacity}%)`
                        };
                    }
                }
            }
        }
        
        // CO2を描画
        for (let x = 0; x < gridWidth; x++) {
            for (let y = 0; y < gridHeight; y++) {
                const co2Level = co2Map[x][y];
                
                if (co2Level > 0.03) {
                    // グリッドの中心座標を計算
                    const centerX = x * gridSize + gridSize / 2;
                    const centerY = y * gridSize + gridSize / 2;
                    
                    // グリッド内のランダムな位置にCO2を表示
                    const offsetX = (Math.random() - 0.5) * gridSize;
                    const offsetY = (Math.random() - 0.5) * gridSize;
                    
                    const projectedX = Math.floor(centerX + offsetX);
                    const projectedY = Math.floor(centerY + offsetY);
                    
                    if (projectedX >= 0 && projectedX < width && 
                        projectedY >= 0 && projectedY < height) {
                        const bufferIndex = projectedY * width + projectedX;
                        
                        // CO2濃度に応じて表示を変える
                        let displayChar, opacity, lightness, saturation;
                        
                        displayChar = co2Level > 0.7 ? '∙' : 
                                    co2Level > 0.4 ? '·' : 
                                    '·';
                        opacity = 30 + co2Level * 30; // 不透明度を30-60%に
                        lightness = 50 + co2Level * 20; // 明るさを50-70%に
                        saturation = 50; // 彩度を50%に
                        
                        // CO2は酸素より優先度を下げる
                        if (zBuffer[bufferIndex].char === ' ' || zBuffer[bufferIndex].depth > 0) {
                            zBuffer[bufferIndex] = {
                                char: displayChar,
                                depth: 0, // 酸素より前、他のオブジェクトより後ろに表示
                                color: `hsla(0, ${saturation}%, ${lightness}%, ${opacity}%)`
                            };
                        }
                    }
                }
            }
        }
        
        // バクテリアを描画（植物の描画の後に追加）
        for (const bacterium of bacteria) {
            const projectedX = Math.floor(bacterium.position.x);
            const projectedY = Math.floor(bacterium.position.y);
            
            if (projectedX >= 0 && projectedX < width && 
                projectedY >= 0 && projectedY < height) {
                const bufferIndex = projectedY * width + projectedX;
                
                if (bacterium.position.z < zBuffer[bufferIndex].depth) {
                    // エネルギーに応じて表示を変える
                    const displayChar = bacterium.energy > 0.7 ? '·' : 
                                     bacterium.energy > 0.4 ? ',' : '˙';
                    
                    // より地味な色に変更
                    const hue = 40; // 茶色っぽい色
                    const saturation = 20 + bacterium.energy * 15; // 彩度を下げる
                    const lightness = 30 + bacterium.energy * 15; // 明度も抑える
                    const opacity = 30 + bacterium.energy * 20; // 透明度を上げる
                    
                    zBuffer[bufferIndex] = {
                        char: displayChar,
                        depth: bacterium.position.z,
                        color: `hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity}%)`
                    };
                }
            }
        }
        
        // 植物の死骸を描画
        for (const debris of plantDebris) {
            const projectedX = Math.floor(debris.position.x);
            const projectedY = Math.floor(debris.position.y);
            
            if (projectedX >= 0 && projectedX < width && 
                projectedY >= 0 && projectedY < height) {
                const bufferIndex = projectedY * width + projectedX;
                
                if (debris.position.z < zBuffer[bufferIndex].depth) {
                    const displayChar = debris.isSettled ? '░' : '▒';
                    
                    zBuffer[bufferIndex] = {
                        char: displayChar,
                        depth: debris.position.z,
                        color: `hsla(${debris.color.hue}, ${debris.color.saturation}%, ${debris.color.lightness}%, ${debris.color.opacity}%)`
                    };
                }
            }
        }

        // 毒素を描画
        for (const toxic of toxicMatters) {
            const projectedX = Math.floor(toxic.position.x);
            const projectedY = Math.floor(toxic.position.y);
            
            if (projectedX >= 0 && projectedX < width && 
                projectedY >= 0 && projectedY < height) {
                const bufferIndex = projectedY * width + projectedX;
                
                if (toxic.position.z < zBuffer[bufferIndex].depth) {
                    // 分解段階に応じて表示を変える
                    let displayChar, color;
                    
                    switch (toxic.decompositionStage) {
                        case 0: // 未分解の毒素
                            displayChar = '▓';
                            color = `hsla(300, 70%, 30%, ${toxic.toxicity * 20}%)`; // より暗い紫色、透明度をさらに上げる
                            break;
                        case 1: // 分解中
                            displayChar = '▒';
                            color = `hsla(300, 50%, 40%, ${(1 - toxic.decompositionProgress) * toxic.toxicity * 20}%)`; // さらに暗い紫色、透明度をさらに上げる
                            break;
                        case 2: // 堆肥
                            displayChar = '░';
                            color = 'hsla(30, 70%, 30%, 70%)'; // 茶色
                            break;
                    }
                    
                    zBuffer[bufferIndex] = {
                        char: displayChar,
                        depth: toxic.position.z,
                        color: color
                    };
                }
            }
        }
        
        // Z-bufferから文字列を生成
        let output = '';
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                if (zBuffer[index].char !== ' ') {
                    output += `<span style="color:${zBuffer[index].color}">${zBuffer[index].char}</span>`;
                } else {
                    output += '&nbsp;';
                }
            }
            output += '<br>';
        }
        
        // キャンバスに描画
        canvas.innerHTML = output;
        
        // 次のフレーム
        time += 1;
        
        // 統計情報を表示（デバッグ用）
        if (time % 60 === 0) {
            const predatorCount = lifeforms.filter(l => l.isPredator).length;
            const preyCount = lifeforms.length - predatorCount;
            console.log(`Time: ${time}, Lifeforms: ${lifeforms.length} (Predators: ${predatorCount}, Prey: ${preyCount}), Foods: ${plants.length}`);
        }
            setTimeout(() => {
                requestAnimationFrame(render);
            }, 1000 / 60);
    }
    
    // アニメーション開始
    render();
    
    // ウィンドウサイズ変更時の処理
    window.addEventListener('resize', () => {
        // フォントサイズを調整（正方形のグリッドになるように）
        const fontWidth = Math.floor(window.innerWidth / width);
        const fontHeight = Math.floor(window.innerHeight / height);
        const fontSize = Math.min(fontWidth, fontHeight);
        canvas.style.fontSize = `${fontSize}px`;
    });
    
    // 初期フォントサイズ設定
    const fontWidth = Math.floor(window.innerWidth / width);
    const fontHeight = Math.floor(window.innerHeight / height);
    const fontSize = Math.min(fontWidth, fontHeight);
    canvas.style.fontSize = `${fontSize}px`;

    // 嫌気性バクテリアクラスを追加
    class AnaerobicBacteria {
        constructor(x, y, z, dna = null) {
            this.position = {
                x: x !== undefined ? x : Math.random() * width,
                y: y !== undefined ? y : height - 2 - Math.random() * 3,
                z: z || 0
            };

            // 遺伝情報の初期化
            this.dna = dna || {
                // 基本的な特性
                speed: 0.1 + Math.random() * 0.2, // 好気性より遅め
                efficiency: 0.6 + Math.random() * 0.3, // 好気性より効率的
                decompositionPower: 0.5 + Math.random() * 0.4,
                oxygenSensitivity: 0.5 + Math.random() * 0.3, // 酸素への耐性（低いほど敏感）
                size: 0.1 + Math.random() * 0.1,
                reproductionRate: 0.1 + Math.random() * 0.2,
                
                // 環境適応性
                depthPreference: 0.6 + Math.random() * 0.4, // 0.6-1.0: 深層を好む
                organicMatterAffinity: 0.4 + Math.random() * 0.4, // 有機物への親和性
                
                // 社会性
                cooperationFactor: Math.random(), // 他のバクテリアとの協調性
                territorialBehavior: Math.random(), // 縄張り意識の強さ
                
                // 特殊能力
                fermentationEfficiency: 0.4 + Math.random() * 0.4 // 発酵効率
            };

            // 世代と遺伝的安定性を追加
            this.generation = 1;
            this.ancestralStability = 1.0;

            this.energy = 0.5 + Math.random() * 0.3;
            this.age = 0;
            this.maxAge = 250 + Math.floor(Math.random() * 150);
            this.size = this.dna.size;
            this.velocity = { x: 0, y: 0, z: 0 };
            this.searchRadius = 15;
            this.currentTarget = null;
            this.decompositionEfficiency = this.dna.decompositionPower;
        }

        // DNAを文字列に変換するメソッド
        getDNAString() {
            const toHex = (value) => {
                return Math.floor(value * 255).toString(16).padStart(2, '0');
            };

            return Object.values(this.dna).map(toHex).join('');
        }

        // 文字列からDNAを復元する静的メソッド
        static fromDNAString(dnaString) {
            const fromHex = (hex) => {
                return parseInt(hex, 16) / 255;
            };

            const values = [];
            for (let i = 0; i < dnaString.length; i += 2) {
                values.push(fromHex(dnaString.substr(i, 2)));
            }

            return {
                speed: values[0],
                efficiency: values[1],
                decompositionPower: values[2],
                oxygenSensitivity: values[3],
                size: values[4],
                reproductionRate: values[5],
                depthPreference: values[6],
                organicMatterAffinity: values[7],
                cooperationFactor: values[8],
                territorialBehavior: values[9],
                fermentationEfficiency: values[10]
            };
        }

        // 遺伝情報を取得
        getGeneticCode() {
            return {
                dnaString: this.getDNAString(),
                generation: this.generation || 1,
                ancestralStability: this.ancestralStability || 1.0
            };
        }

        // 遺伝情報から新しいバクテリアを生成する静的メソッド
        static fromGeneticCode(geneticCode, x, y, z, energy) {
            const dna = AnaerobicBacteria.fromDNAString(
                AnaerobicBacteria.mutateGeneticCode(
                    geneticCode.dnaString,
                    geneticCode.generation,
                    geneticCode.ancestralStability
                )
            );
            
            const offspring = new AnaerobicBacteria(x, y, z, dna);
            offspring.generation = geneticCode.generation + 1;
            offspring.ancestralStability = Math.max(0.1, geneticCode.ancestralStability * 0.995);
            offspring.energy = energy;
            
            return offspring;
        }

        // 遺伝情報に変異を加える静的メソッド
        static mutateGeneticCode(dnaString, generation, stability) {
            const mutationRate = 0.05 * (1 - stability);
            let mutatedDna = '';
            
            for (let i = 0; i < dnaString.length; i += 2) {
                const genePair = dnaString.substr(i, 2);
                const positionFactor = 1 - (i / dnaString.length);
                const geneComplexity = parseInt(genePair, 16) / 255;
                
                const finalMutationRate = mutationRate * 
                    positionFactor * 
                    (1 + generation * 0.01) * 
                    (1 - geneComplexity * 0.5);
                
                if (Math.random() < finalMutationRate) {
                    const mutationStrength = 0.8 + Math.random() * 0.4;
                    let value = parseInt(genePair, 16);
                    value = Math.floor(value * mutationStrength);
                    value = Math.max(0, Math.min(255, value));
                    mutatedDna += value.toString(16).padStart(2, '0');
                } else {
                    mutatedDna += genePair;
                }
            }
            
            return mutatedDna;
        }

        update(plantDebris, oxygens) {
            this.age++;

            // 基礎代謝によるエネルギー消費（効率に基づく）
            const baseMetabolism = 0.001 * (1 + this.size) * (1 - this.dna.efficiency * 0.5);
            this.energy -= baseMetabolism;

            // 移動によるエネルギー消費（速度と効率に基づく）
            const movementCost = Math.sqrt(
                this.velocity.x * this.velocity.x +
                this.velocity.y * this.velocity.y
            ) * 0.002 * (1 - this.dna.efficiency * 0.3);
            this.energy -= movementCost;
            
            // 酸素による悪影響（感受性に基づく）
            if (oxygens && typeof oxygens.getOxygenAt === 'function') {
                const localOxygen = oxygens.getOxygenAt(this.position.x, this.position.y);
                if (localOxygen > 0.2) {
                    const oxygenDamage = 0.002 * (localOxygen - 0.2) * this.dna.oxygenSensitivity;
                    this.energy -= oxygenDamage;
                }
            }

            // 死亡条件をチェック
            if (this.energy <= 0 || this.age >= this.maxAge) {
                return true;
            }
            
            // 現在の対象がなければ新しい有機物を探す
            if (!this.currentTarget) {
                let closestDist = this.searchRadius;
                let closestDebris = null;

                for (const debris of plantDebris) {
                    if (debris.isSettled && !debris.isCompost) {
                        const dx = this.position.x - debris.position.x;
                        const dy = this.position.y - debris.position.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        // 深度選好性と有機物親和性に基づいて距離を調整
                        const depthFactor = Math.abs(this.dna.depthPreference - (debris.position.y / height));
                        const affinityFactor = 1 - this.dna.organicMatterAffinity;
                        const adjustedDistance = distance * (1 + depthFactor) * (1 + affinityFactor);

                        if (adjustedDistance < closestDist) {
                            closestDist = adjustedDistance;
                            closestDebris = debris;
                        }
                    }
                }

                if (closestDebris) {
                    this.currentTarget = closestDebris;
                }
            }

            // 対象が見つかった場合の処理
            if (this.currentTarget) {
                const dx = this.currentTarget.position.x - this.position.x;
                const dy = this.currentTarget.position.y - this.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 3) {
                    // 有機物の分解（分解効率と発酵効率に基づく）
                    this.currentTarget.anaerobicBacteriaCount++;
                    const decompositionEfficiency = this.dna.decompositionPower * 
                        (1 + this.dna.fermentationEfficiency * 0.5);
                    
                    // エネルギー獲得（効率に基づく）
                    const energyGain = 0.005 * decompositionEfficiency * this.dna.efficiency;
                    this.energy = Math.min(1.0, this.energy + energyGain);
                } else {
                    // 対象に向かって移動
                    const moveSpeed = this.dna.speed;
                    this.velocity.x = (dx / distance) * moveSpeed;
                    this.velocity.y = (dy / distance) * moveSpeed;
                }
            } else {
                // ランダムな移動（社会性に基づく）
                if (Math.random() < 0.05) {
                    // 他のバクテリアとの相互作用を考慮
                    let socialForce = { x: 0, y: 0 };
                    let nearbyCount = 0;
                    
                    for (const other of anaerobicBacteria) {
                        if (other === this) continue;
                        
                        const dx = other.position.x - this.position.x;
                        const dy = other.position.y - this.position.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance < 10) {
                            // 協調性と縄張り意識に基づく力を計算
                            const socialFactor = (this.dna.cooperationFactor - 
                                this.dna.territorialBehavior) / distance;
                            socialForce.x += dx * socialFactor;
                            socialForce.y += dy * socialFactor;
                            nearbyCount++;
                        }
                    }
                    
                    if (nearbyCount > 0) {
                        // 社会的な力を正規化して適用
                        const forceMagnitude = Math.sqrt(
                            socialForce.x * socialForce.x + 
                            socialForce.y * socialForce.y
                        );
                        if (forceMagnitude > 0) {
                            this.velocity.x = (socialForce.x / forceMagnitude) * this.dna.speed;
                            this.velocity.y = (socialForce.y / forceMagnitude) * this.dna.speed;
                }
            } else {
                        // 他のバクテリアが近くにいない場合はランダムな移動
                        this.velocity.x = (Math.random() - 0.5) * this.dna.speed;
                        this.velocity.y = (Math.random() - 0.5) * this.dna.speed;
                    }
                }
            }

            // 位置の更新と境界チェック
            this.position.x += this.velocity.x;
            this.position.y += this.velocity.y;

            // 水平方向の境界
            if (this.position.x < 0) {
                this.position.x = 0;
                this.velocity.x *= -0.5;
            } else if (this.position.x >= width) {
                this.position.x = width - 1;
                this.velocity.x *= -0.5;
            }
            
            // 垂直方向の境界（深度選好性に基づく）
            const preferredDepth = this.dna.depthPreference * height;
            const depthDifference = this.position.y - preferredDepth;
            this.velocity.y -= depthDifference * 0.001;

            // 繁殖判定（繁殖率に基づく）
            if (this.energy > 0.7 && Math.random() < this.dna.reproductionRate * 0.1) {
                this.reproduce();
            }

            return false;
        }

        reproduce() {
            if (anaerobicBacteria.length >= Math.floor(bacteriaMaxCount * 0.5)) return false;

            const offspringCount = 1 + Math.floor(Math.random() * 2);
            const energyCost = this.energy * 0.4;
            this.energy -= energyCost;

            const geneticCode = this.getGeneticCode();

            for (let i = 0; i < offspringCount; i++) {
                const spreadDistance = 2 + Math.random() * 2;
                const angle = Math.random() * Math.PI * 2;
                
                const offspring = AnaerobicBacteria.fromGeneticCode(
                    geneticCode,
                    this.position.x + Math.cos(angle) * spreadDistance,
                    this.position.y + Math.sin(angle) * spreadDistance,
                    0,
                    energyCost / offspringCount * 0.8
                );
                
                anaerobicBacteria.push(offspring);
            }
            
            return false;
        }
    }

    // 初期の嫌気性バクテリアを生成
    const initialAnaerobicBacteriaCount = Math.floor(width * 0.03);
    for (let i = 0; i < initialAnaerobicBacteriaCount; i++) {
        const x = Math.random() * width;
        const y = height - 2 - Math.random() * 3;
        anaerobicBacteria.push(new AnaerobicBacteria(x, y, 0));
    }

    // 初期の堆肥を生成
    const initialCompostCount = Math.floor(width * 0.2); // 画面幅の20%の数の堆肥を生成
    for (let i = 0; i < initialCompostCount; i++) {
        const x = Math.random() * width;
        const y = height - 1 - Math.random() * 3; // 底面付近に配置
        const debris = new PlantDebris(x, y, 0, 0.2 + Math.random() * 0.3);
        
        // 堆肥化が完了した状態に設定
        debris.isSettled = true;
        debris.decompositionProgress = 1;
        debris.isCompost = true;
        debris.compostNutrientValue = 0.5 + Math.random() * 0.3;
        debris.color = {
            hue: 25,
            saturation: 70,
            lightness: 15,
            opacity: 90
        };
        
        plantDebris.push(debris);
    }

    // 初期化部分を修正（Oxygen, CO2オブジェクトの生成を削除）
    // 初期酸素と二酸化炭素の分布を設定
    function initializeGasDistribution() {
        // 上部に酸素が多い分布
        for (let x = 0; x < gridWidth; x++) {
            for (let y = 0; y < gridHeight; y++) {
                // 上部ほど酸素濃度が高い
                const heightFactor = 1 - (y / gridHeight);
                oxygenMap[x][y] = initialOxygenDensity * (0.5 + heightFactor * 0.5);
                
                // 下部ほど二酸化炭素濃度が高い
                const depthFactor = y / gridHeight;
                co2Map[x][y] = initialCO2Density * (0.5 + depthFactor * 0.5);
                
                // ランダム要素を加える
                oxygenMap[x][y] += (Math.random() - 0.5) * 0.1;
                co2Map[x][y] += (Math.random() - 0.5) * 0.1;
                
                // 範囲内に収める
                oxygenMap[x][y] = Math.max(0, Math.min(maxOxygenLevel, oxygenMap[x][y]));
                co2Map[x][y] = Math.max(0, Math.min(maxCO2Level, co2Map[x][y]));
            }
        }
    }
    
    // 初期化
    initializeGasDistribution();

    // 指定した位置の酸素濃度を取得
    function getOxygenAt(x, y) {
        const gridX = Math.floor(x / gridSize);
        const gridY = Math.floor(y / gridSize);
        
        if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
            return oxygenMap[gridX][gridY];
        }
        return 0;
    }
    
    // 指定した位置の二酸化炭素濃度を取得
    function getCO2At(x, y) {
        const gridX = Math.floor(x / gridSize);
        const gridY = Math.floor(y / gridSize);
        
        if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
            return co2Map[gridX][gridY];
        }
        return 0;
    }
    
    // 指定した位置の酸素濃度を変更
    function changeOxygenAt(x, y, amount) {
        const gridX = Math.floor(x / gridSize);
        const gridY = Math.floor(y / gridSize);
        
        if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
            oxygenMap[gridX][gridY] = Math.max(0, Math.min(maxOxygenLevel, oxygenMap[gridX][gridY] + amount));
            return true;
        }
        return false;
    }
    
    // 指定した位置の二酸化炭素濃度を変更
    function changeCO2At(x, y, amount) {
        const gridX = Math.floor(x / gridSize);
        const gridY = Math.floor(y / gridSize);
        
        if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
            co2Map[gridX][gridY] = Math.max(0, Math.min(maxCO2Level, co2Map[gridX][gridY] + amount));
            return true;
        }
        return false;
    }
    
    // 濃度の拡散処理
    function diffuseGases() {
        // 酸素の拡散
        const newOxygenMap = Array(gridWidth).fill().map(() => Array(gridHeight).fill(0));
        const newCO2Map = Array(gridWidth).fill().map(() => Array(gridHeight).fill(0));
        
        for (let x = 0; x < gridWidth; x++) {
            for (let y = 0; y < gridHeight; y++) {
                let oxygenSum = oxygenMap[x][y];
                let co2Sum = co2Map[x][y];
                let count = 1;
                
                // 隣接セルからの拡散
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        
                        const nx = x + dx;
                        const ny = y + dy;
                        
                        if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
                            // 拡散率を0.02から0.01に下げる
                            oxygenSum += oxygenMap[nx][ny] * 0.01;
                            co2Sum += co2Map[nx][ny] * 0.01;
                            count++;
                        }
                    }
                }
                
                // 拡散後の新しい値を計算
                newOxygenMap[x][y] = oxygenMap[x][y] * 0.99 + 
                                    (oxygenSum - oxygenMap[x][y]) / count * 0.01;
                
                newCO2Map[x][y] = co2Map[x][y] * 0.99 + 
                                 (co2Sum - co2Map[x][y]) / count * 0.01;
                
                // 自然減衰率を調整
                newOxygenMap[x][y] *= 0.999;
                newCO2Map[x][y] *= 0.999;
                
                // 浮力効果の調整（より緩やかに）
                if (y > 0) {
                    newOxygenMap[x][y-1] += newOxygenMap[x][y] * 0.005; // 0.01から0.005に減少
                    newOxygenMap[x][y] *= 0.995;
                }
                
                if (y < gridHeight - 1) {
                    newCO2Map[x][y+1] += newCO2Map[x][y] * 0.005; // 0.01から0.005に減少
                    newCO2Map[x][y] *= 0.995;
                }
            }
        }
        
        // 新しい値で更新
        for (let x = 0; x < gridWidth; x++) {
            for (let y = 0; y < gridHeight; y++) {
                oxygenMap[x][y] = newOxygenMap[x][y];
                co2Map[x][y] = newCO2Map[x][y];
            }
        }
    }

    // 初期植物の死骸を生成
    for (let i = 0; i < initialPlantDebrisCount; i++) {
        const x = Math.random() * width;
        const y = height - Math.random() * 20; // 底部に配置
        const debris = new PlantDebris(
            x,
            y,
            0,
            0.2 + Math.random() * 0.3
        );
        plantDebris.push(debris);
    }

    // 初期化
    initializeGasDistribution();

    // 初期浄化バクテリアの生成
    for (let i = 0; i < initialBacteriaCount; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height * 0.8; // 上部80%に配置
        const bacterium = new PurifierBacteria(
            x,
            y,
            0
        );
        bacteria.push(bacterium);
    }

    // 初期嫌気性バクテリアの生成
    for (let i = 0; i < initialBacteriaCount / 2; i++) {
        const x = Math.random() * width;
        const y = height - Math.random() * 20; // 底部に配置
        const bacterium = new AnaerobicBacteria(
            x,
            y,
            0
        );
        anaerobicBacteria.push(bacterium);
    }
}); 