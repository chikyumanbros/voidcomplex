document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    // 幅と高さの比率を1:1に近づける（正方形のグリッドになるように）
    const width = 160;
    const height = 90;
    
    // ASCII文字のセット - 単純に密度を表現
    const asciiChars = '█▓▒░+*·';
    
    // 最小限のシミュレーションパラメータ
    const initialEntityCount = 10;
    const maxEntities = 400;
    const baseEnergyDecay = 0.0005;  // エネルギー消費を抑制
    const DIVISION_ENERGY_THRESHOLD = 0.5;  // 分裂しきい値を下げる
    const DIVISION_PROBABILITY = 0.02;      // 分裂確率を上げる
    
    // 時間変数
    let time = 0;
    
    // グローバル変数としてシステム全体のエネルギー総量を定義
    const TOTAL_SYSTEM_ENERGY = 1000;  // 任意の単位
    
    // Entityクラス - 抽象的な「実体」として再定義
    class Entity {
        constructor(x, y, z, attributes = null) {
            // 位置
            this.position = {
                x: x !== undefined ? x : Math.random() * width,
                y: y !== undefined ? y : Math.random() * height,
                z: z !== undefined ? z : Math.random() * 20 - 10
            };
            
            // 速度
            this.velocity = {
                x: (Math.random() - 0.5) * 0.5,
                y: (Math.random() - 0.5) * 0.5,
                z: (Math.random() - 0.5) * 0.5
            };
            
            // 基本属性 - より抽象的なパラメータへ
            this.attributes = attributes || {
                // センサー感度 - 環境変化の検知能力
                sensorSensitivity: Math.random(),
                
                // エネルギー変換率 - 環境からエネルギーを得る効率
                energyConversion: Math.random(),
                
                // 運動効率 - 動くためのエネルギー効率
                movementEfficiency: Math.random(),
                
                // 反応速度 - 環境変化への対応速度
                responseRate: Math.random(),
                
                // 構造強度 - 物理的耐久性
                structuralIntegrity: Math.random()
            };
            
            // エネルギーと状態
            this.energy = 0.5 + Math.random() * 0.5;
            this.age = 0;
            this.isActive = true;
            this.density = 0.1 + Math.random() * 0.9; // 密度（表示サイズに影響）
            
            // 新しい情報交換関連の属性を追加
            this.signals = {
                presence: 0.5 + Math.random() * 0.5,  // 存在のシグナル強度
                boundary: 0.3 + Math.random() * 0.7   // 境界のシグナル強度
            };
            
            // 内部状態の保存（記憶）
            this.memory = {
                signalGradients: {},     // 各シグナルタイプの勾配
                lastPosition: {...this.position},  // 前回の位置
                signalHistory: {},        // シグナル履歴
                sensedEntities: []        // 検知した実体を記憶
            };
            
            // Entityクラスに追加する属性
            this.wonder = {
                curiosity: Math.random(),  // 好奇心の強さ
                explorationMap: {},        // 探索済みの領域を記録
                noveltyThreshold: 0.3 + Math.random() * 0.4,  // 新奇性の閾値
                lastNoveltyEncounter: 0    // 最後に新奇なものに遭遇した時間
            };
            
            // Entityクラスのコンストラクタ内に追加
            this.genome = {
                // 遺伝子配列（0と1のバイナリ配列）
                sequence: attributes ? this.encodeAttributes(attributes) : this.generateRandomGenome(),
                
                // 遺伝子の発現状態（実際の属性値に変換されたもの）
                expression: attributes || this.decodeGenome(this.sequence)
            };
        }
        
        // 既存のinteractメソッドを維持しながら、情報交換の概念を追加
        interact(entities, environment) {
            let forces = { x: 0, y: 0, z: 0 };
            
            // 他の実体を感知
            this.senseEntities(entities);
            
            // boidモデルによる力を計算
            const boidForces = this.calculateBoidForces();
            forces.x += boidForces.x;
            forces.y += boidForces.y;
            forces.z += boidForces.z;
            
            // エネルギー交換を実行
            this.exchangeEnergy(entities);
            
            // 他の実体への反応
            const entityForces = this.reactToEntities();
            forces.x += entityForces.x;
            forces.y += entityForces.y;
            forces.z += entityForces.z;
            
            // 境界処理
            this.enforceBoundaries(forces);
            
            return forces;
        }
        
        // boidモデルの力を計算
        calculateBoidForces() {
            if (!this.memory.sensedEntities || this.memory.sensedEntities.length === 0) {
                return { x: 0, y: 0, z: 0 };
            }

            const forces = { x: 0, y: 0, z: 0 };
            const cohesion = { x: 0, y: 0, z: 0 };
            const alignment = { x: 0, y: 0, z: 0 };
            const separation = { x: 0, y: 0, z: 0 };
            
            let totalWeight = 0;
            let separationCount = 0;

            for (const sensed of this.memory.sensedEntities) {
                const other = sensed.entity;
                const similarity = this.calculateGeneticSimilarity(other);
                
                // 遺伝的類似度が高いほど強く影響
                const weight = Math.pow(similarity, 2);
                
                // 結合（中心に向かう力）
                cohesion.x += other.position.x * weight;
                cohesion.y += other.position.y * weight;
                cohesion.z += other.position.z * weight;
                
                // 整列（同じ方向に向かう力）
                alignment.x += other.velocity.x * weight;
                alignment.y += other.velocity.y * weight;
                alignment.z += other.velocity.z * weight;
                
                // 分離（近すぎる個体から離れる力）
                if (sensed.distance < 5) {
                    const repulsionStrength = (5 - sensed.distance) / 5;
                    separation.x += sensed.direction.x * repulsionStrength;
                    separation.y += sensed.direction.y * repulsionStrength;
                    separation.z += sensed.direction.z * repulsionStrength;
                    separationCount++;
                }
                
                totalWeight += weight;
            }

            // 結合力の正規化と適用
            if (totalWeight > 0) {
                const cohesionStrength = 0.01;
                forces.x += (cohesion.x / totalWeight - this.position.x) * cohesionStrength;
                forces.y += (cohesion.y / totalWeight - this.position.y) * cohesionStrength;
                forces.z += (cohesion.z / totalWeight - this.position.z) * cohesionStrength;
                
                // 整列力の正規化と適用
                const alignmentStrength = 0.05;
                forces.x += (alignment.x / totalWeight) * alignmentStrength;
                forces.y += (alignment.y / totalWeight) * alignmentStrength;
                forces.z += (alignment.z / totalWeight) * alignmentStrength;
            }

            // 分離力の適用
            if (separationCount > 0) {
                const separationStrength = 0.1;
                forces.x -= separation.x * separationStrength / separationCount;
                forces.y -= separation.y * separationStrength / separationCount;
                forces.z -= separation.z * separationStrength / separationCount;
            }

            return forces;
        }
        
        // 新しいシグナル受信メソッド
        receiveSignal(sourcePosition, signalType, intensity) {
            const dx = sourcePosition.x - this.position.x;
            const dy = sourcePosition.y - this.position.y;
            const dz = sourcePosition.z - this.position.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            // 距離による減衰
            const attenuatedIntensity = intensity / (1 + distance * distance);
            
            // シグナル履歴の初期化
            if (!this.memory.signalHistory[signalType]) {
                this.memory.signalHistory[signalType] = [];
            }
            
            // シグナルと方向の記録
            this.memory.signalHistory[signalType].push({
                intensity: attenuatedIntensity,
                direction: {
                    x: dx / Math.max(0.001, distance),
                    y: dy / Math.max(0.001, distance),
                    z: dz / Math.max(0.001, distance)
                },
                time: time
            });
            
            // 古いシグナルの削除（メモリ制限）
            const memoryDuration = 10; // 記憶する時間
            this.memory.signalHistory[signalType] = 
                this.memory.signalHistory[signalType].filter(s => time - s.time < memoryDuration);
            
            // シグナル勾配の更新
            this.updateSignalGradient(signalType);
        }
        
        // シグナル勾配の更新
        updateSignalGradient(signalType) {
            if (!this.memory.signalHistory[signalType] || 
                this.memory.signalHistory[signalType].length === 0) {
                return;
            }
            
            let gradX = 0, gradY = 0, gradZ = 0, totalIntensity = 0;
            
            for (const signal of this.memory.signalHistory[signalType]) {
                gradX += signal.direction.x * signal.intensity;
                gradY += signal.direction.y * signal.intensity;
                gradZ += signal.direction.z * signal.intensity;
                totalIntensity += signal.intensity;
            }
            
            // 勾配の正規化
            this.memory.signalGradients[signalType] = {
                x: totalIntensity > 0 ? gradX / totalIntensity : 0,
                y: totalIntensity > 0 ? gradY / totalIntensity : 0,
                z: totalIntensity > 0 ? gradZ / totalIntensity : 0,
                intensity: totalIntensity / this.memory.signalHistory[signalType].length
            };
        }
        
        // シグナル勾配に基づく力の計算
        processSignalGradients() {
            const forces = { x: 0, y: 0, z: 0 };
            
            // 存在シグナルへの反応（混雑回避）
            if (this.memory.signalGradients.presence) {
                const grad = this.memory.signalGradients.presence;
                const repulsionStrength = 0.01 * this.attributes.responseRate;
                
                forces.x -= grad.x * repulsionStrength * grad.intensity;
                forces.y -= grad.y * repulsionStrength * grad.intensity;
                forces.z -= grad.z * repulsionStrength * grad.intensity;
            }
            
            // 境界シグナルへの反応
            if (this.memory.signalGradients.boundary) {
                const grad = this.memory.signalGradients.boundary;
                const boundaryStrength = 0.02 * this.signals.boundary;
                
                // 強い境界からは離れる
                if (grad.intensity > this.signals.boundary) {
                    forces.x -= grad.x * boundaryStrength;
                    forces.y -= grad.y * boundaryStrength;
                    forces.z -= grad.z * boundaryStrength;
                }
            }
            
            return forces;
        }
        
        // 揺らぎの追加
        addBrownianMotion() {
            // エネルギーレベルと相関する揺らぎの強さ
            const brownianStrength = 0.01 * (1 - this.energy * 0.5);
            
            return {
                x: (Math.random() - 0.5) * brownianStrength,
                y: (Math.random() - 0.5) * brownianStrength,
                z: (Math.random() - 0.5) * brownianStrength
            };
        }
        
        // エネルギー処理のメソッドを追加
        processEnergy(environment, subjectiveTimeScale = 1.0) {
            // 基本的なエネルギー消費
            const baseCost = baseEnergyDecay * (1 - this.attributes.movementEfficiency * 0.5) * subjectiveTimeScale;
            this.energy -= baseCost;
            
            // 消費したエネルギーを環境に戻す（熱として）
            environment.returnEnergyAt(this.position, baseCost);
            
            // シグナル処理によるエネルギー消費を最小化
            const signalProcessingCost = 0.00005 * 
                Object.keys(this.memory.signalHistory).reduce((sum, key) => 
                    sum + this.memory.signalHistory[key].length, 0) * subjectiveTimeScale;
            
            this.energy -= signalProcessingCost;
            environment.returnEnergyAt(this.position, signalProcessingCost);
            
            // 環境からのエネルギー獲得（最大獲得可能量を計算）
            const depthFactor = Math.max(0, 1 - Math.abs(this.position.z) / 10);
            const maxExtractableEnergy = 0.02 * this.attributes.energyConversion * depthFactor * subjectiveTimeScale;
            
            // 環境から実際にエネルギーを取得（利用可能量に制限される）
            const gainedEnergy = environment.getEnergyAt(this.position, time, maxExtractableEnergy);
            this.energy += gainedEnergy;
            
            // エネルギー上限
            this.energy = Math.min(this.energy, 1.0);
        }
        
        // 既存のupdateメソッドに統合
        update(entities, environment, subjectiveTimeScale = 1.0) {
            if (!this.isActive) return;
            
            // 年齢の更新
            this.age += subjectiveTimeScale;
            
            // エネルギー処理
            this.processEnergy(environment, subjectiveTimeScale);
            
            // 相互作用による力
            const forces = this.interact(entities, environment);
            
            // ワンダーモジュールによる力を追加
            const wonderForces = this.processWonder(environment);
            forces.x += wonderForces.x;
            forces.y += wonderForces.y;
            forces.z += wonderForces.z;
            
            // ブラウン運動による揺らぎ
            const brownian = this.addBrownianMotion();
            
            // 速度の更新（物理的力＋情報的力＋揺らぎ）
            this.velocity.x += forces.x * subjectiveTimeScale + brownian.x;
            this.velocity.y += forces.y * subjectiveTimeScale + brownian.y;
            this.velocity.z += forces.z * subjectiveTimeScale + brownian.z;
            
            // 速度の減衰
            const friction = 0.95;
            this.velocity.x *= Math.pow(friction, subjectiveTimeScale);
            this.velocity.y *= Math.pow(friction, subjectiveTimeScale);
            this.velocity.z *= Math.pow(friction, subjectiveTimeScale);
            
            // 位置の更新
            this.position.x += this.velocity.x * subjectiveTimeScale;
            this.position.y += this.velocity.y * subjectiveTimeScale;
            this.position.z += this.velocity.z * subjectiveTimeScale;
            
            // シグナル強度の更新
            this.signals.presence = 0.3 + this.energy * 0.7;  // エネルギーが高いほど存在感が強い
            this.signals.boundary = Math.min(1.0, 0.2 + this.density * 0.8);  // 密度が高いほど境界が強い
            
            // 分裂判定
            if (this.energy > DIVISION_ENERGY_THRESHOLD && Math.random() < DIVISION_PROBABILITY * subjectiveTimeScale) {
                this.divide(entities);
            }
            
            // 活性状態の更新
            if (this.energy <= 0 || this.age > 1000) {
                // 死亡時に残りのエネルギーを環境に戻す
                environment.returnEnergyAt(this.position, this.energy);
                this.energy = 0;
                this.isActive = false;
            }
            
            // 前回位置を記録
            this.memory.lastPosition = {...this.position};
        }
        
        // 境界処理のメソッドを追加
        enforceBoundaries(forces) {
            const margin = 5;
            const boundaryForce = 0.05;
            
            // X軸の境界
            if (this.position.x < margin) {
                forces.x += boundaryForce;
            } else if (this.position.x > width - margin) {
                forces.x -= boundaryForce;
            }
            
            // Y軸の境界
            if (this.position.y < margin) {
                forces.y += boundaryForce;
            } else if (this.position.y > height - margin) {
                forces.y -= boundaryForce;
            }
            
            // Z軸の境界
            if (this.position.z < -10) {
                forces.z += boundaryForce;
            } else if (this.position.z > 10) {
                forces.z -= boundaryForce;
            }
            
            return forces;
        }
        
        // 分裂（複製）メソッドを追加
        divide(entities) {
            if (entities.length >= maxEntities) return;
            
            // 分裂によるエネルギーを均等に分配
            const splitEnergy = this.energy * 0.5;  // 親のエネルギーを半分に
            this.energy = splitEnergy;              // 親は半分保持
            
            // 親の遺伝子を変異させて子の遺伝子を作成
            const childGenome = this.mutateGenome(this.genome.sequence);
            
            // 子の遺伝子を属性に変換
            const childAttributes = this.decodeGenome(childGenome);
            
            // 親の近くにランダムな位置を設定
            const offset = 2;
            const childX = this.position.x + (Math.random() - 0.5) * offset;
            const childY = this.position.y + (Math.random() - 0.5) * offset;
            const childZ = this.position.z + (Math.random() - 0.5) * offset;
            
            // 新しいエンティティを作成
            const child = new Entity(
                childX,
                childY,
                childZ,
                childAttributes
            );
            
            // 子エンティティの遺伝子を設定
            child.genome = {
                sequence: childGenome,
                expression: childAttributes
            };
            
            // 子エンティティの初期エネルギーを設定（親と同じ量）
            child.energy = splitEnergy;
            
            // シグナル値も遺伝子から生成
            child.signals = {
                presence: 0.3 + childAttributes.responseRate * 0.7,
                boundary: 0.2 + childAttributes.structuralIntegrity * 0.8
            };
            
            // 親の速度を基にした初期速度（わずかにランダム性を加える）
            child.velocity = {
                x: this.velocity.x * 0.8 + (Math.random() - 0.5) * 0.2,
                y: this.velocity.y * 0.8 + (Math.random() - 0.5) * 0.2,
                z: this.velocity.z * 0.8 + (Math.random() - 0.5) * 0.2
            };
            
            // エンティティリストに追加
            entities.push(child);
        }
        
        // 新しいメソッド: ワンダーモジュールの処理
        processWonder(environment) {
            const forces = { x: 0, y: 0, z: 0 };
            
            // 1. 未探索領域への引力
            const currentCell = `${Math.floor(this.position.x)},${Math.floor(this.position.y)}`;
            this.wonder.explorationMap[currentCell] = (this.wonder.explorationMap[currentCell] || 0) + 1;
            
            // 周囲のセルの探索状況を確認
            const radius = 5;
            let leastExploredDir = { x: 0, y: 0, z: 0 };
            let minExplorationCount = Infinity;
            let equallyLeastExploredDirs = [];
            
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    const cell = `${Math.floor(this.position.x + dx)},${Math.floor(this.position.y + dy)}`;
                    const explorationCount = this.wonder.explorationMap[cell] || 0;
                    
                    if (explorationCount < minExplorationCount) {
                        minExplorationCount = explorationCount;
                        equallyLeastExploredDirs = [{ 
                            x: dx / Math.max(1, Math.abs(dx)) || 0, 
                            y: dy / Math.max(1, Math.abs(dy)) || 0,
                            z: 0
                        }];
                    } else if (explorationCount === minExplorationCount) {
                        // 同じ訪問回数の場合、候補に追加
                        equallyLeastExploredDirs.push({ 
                            x: dx / Math.max(1, Math.abs(dx)) || 0, 
                            y: dy / Math.max(1, Math.abs(dy)) || 0,
                            z: 0
                        });
                    }
                }
            }
            
            // 同じ訪問回数の候補からランダムに選択
            if (equallyLeastExploredDirs.length > 0) {
                const randomIndex = Math.floor(Math.random() * equallyLeastExploredDirs.length);
                leastExploredDir = equallyLeastExploredDirs[randomIndex];
            }
            
            // 未探索領域への引力を計算
            const explorationStrength = 0.02 * this.wonder.curiosity;
            forces.x += leastExploredDir.x * explorationStrength;
            forces.y += leastExploredDir.y * explorationStrength;
            
            // 2. 環境の変化への反応
            // 環境エネルギーの勾配を検出し、変化が大きい方向に引き寄せられる
            const cellSize = 1;
            const energyHere = environment.getEnergyAt(this.position, time, 0);
            
            const directions = [
                {dx: cellSize, dy: 0, dz: 0},
                {dx: -cellSize, dy: 0, dz: 0},
                {dx: 0, dy: cellSize, dz: 0},
                {dx: 0, dy: -cellSize, dz: 0}
            ];
            
            let maxGradient = 0;
            let gradientDir = { x: 0, y: 0, z: 0 };
            
            for (const dir of directions) {
                const checkPos = {
                    x: this.position.x + dir.dx,
                    y: this.position.y + dir.dy,
                    z: this.position.z + dir.dz
                };
                
                const energyThere = environment.getEnergyAt(checkPos, time, 0);
                const gradient = Math.abs(energyThere - energyHere);
                
                if (gradient > maxGradient) {
                    maxGradient = gradient;
                    gradientDir = { x: dir.dx, y: dir.dy, z: dir.dz };
                }
            }
            
            // 変化が閾値を超えた場合、その方向に引き寄せられる
            if (maxGradient > this.wonder.noveltyThreshold) {
                const noveltyStrength = 0.03 * this.wonder.curiosity;
                forces.x += gradientDir.x * noveltyStrength;
                forces.y += gradientDir.y * noveltyStrength;
                this.wonder.lastNoveltyEncounter = time;
            }
            
            // 長時間新奇なものに遭遇していない場合、ランダム探索を強化
            const timeSinceNovelty = time - this.wonder.lastNoveltyEncounter;
            if (timeSinceNovelty > 50) {
                const randomExplorationStrength = 0.01 * Math.min(5, timeSinceNovelty / 10);
                forces.x += (Math.random() - 0.5) * randomExplorationStrength;
                forces.y += (Math.random() - 0.5) * randomExplorationStrength;
            }
            
            return forces;
        }
        
        // Entityクラスに追加するメソッド
        senseEntities(entities) {
            const sensedEntities = [];
            
            for (const other of entities) {
                if (other === this || !other.isActive) continue;
                
                // 距離の計算
                const dx = other.position.x - this.position.x;
                const dy = other.position.y - this.position.y;
                const dz = other.position.z - this.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                // センサー感度に基づく検知範囲
                const detectionRange = 15 * this.attributes.sensorSensitivity;
                
                if (distance < detectionRange) {
                    // 他者のエネルギー情報を含めて記録
                    sensedEntities.push({
                        entity: other,
                        distance: distance,
                        direction: {
                            x: dx / Math.max(0.001, distance),
                            y: dy / Math.max(0.001, distance),
                            z: dz / Math.max(0.001, distance)
                        },
                        perceivedEnergy: other.energy * (1 - distance / detectionRange) // 距離による減衰
                    });
                }
            }
            
            // 検知した実体を記憶に保存
            this.memory.sensedEntities = sensedEntities;
            
            return sensedEntities;
        }
        
        // エネルギー交換メソッドの修正
        exchangeEnergy(entities) {
            if (!this.memory.sensedEntities || this.memory.sensedEntities.length === 0) return;
            
            // エネルギー交換の総量（この実体が交換できる最大量）
            const maxExchangeAmount = 0.05 * this.energy;
            
            // 各検知実体との交換を試みる
            for (const sensed of this.memory.sensedEntities) {
                const other = sensed.entity;
                
                // 遺伝的類似度を計算
                const similarity = this.calculateGeneticSimilarity(other);
                
                // エネルギー状態の差異
                const energyDiff = this.energy - other.energy;
                const efficiencyDiff = this.attributes.energyConversion - other.attributes.energyConversion;
                
                // 基本的な相互作用の強さ（-1から1の範囲）
                // 類似度が高いほど、エネルギー差に基づく自然な均衡化が起きやすい
                const baseInteraction = -Math.sign(energyDiff) * similarity;
                
                // 効率差による影響（効率の良い方が得をする傾向）
                const efficiencyEffect = Math.sign(efficiencyDiff) * Math.abs(efficiencyDiff) * (1 - similarity);
                
                // 最終的な交換方向の決定
                const exchangeDirection = baseInteraction + efficiencyEffect;
                
                // 距離による減衰
                const distanceFactor = 1 - sensed.distance / (15 * this.attributes.sensorSensitivity);
                
                // 実際の交換量を計算
                const exchangeAmount = maxExchangeAmount * exchangeDirection * distanceFactor;
                
                // 相互作用タイプの判定（事後的な分類）
                const interactionType = this.classifyInteraction(exchangeDirection, similarity, efficiencyDiff);
                
                // エネルギー交換の実行
                if (exchangeAmount > 0) {
                    const actualGain = Math.min(exchangeAmount, other.energy * 0.2);
                    this.energy += actualGain;
                    other.energy -= actualGain;
                    
                    // 相互作用の記憶
                    this.recordInteraction(interactionType, 'gain', other, actualGain, similarity);
                } else if (exchangeAmount < 0) {
                    const actualLoss = Math.min(-exchangeAmount, this.energy * 0.2);
                    this.energy -= actualLoss;
                    other.energy += actualLoss;
                    
                    // 相互作用の記憶
                    this.recordInteraction(interactionType, 'give', other, actualLoss, similarity);
                }
            }
        }
        
        // 相互作用の記録
        recordInteraction(type, direction, target, amount, similarity) {
            if (!this.memory.interactions) this.memory.interactions = [];
            this.memory.interactions.push({
                type: type,
                direction: direction,
                target: target,
                amount: amount,
                similarity: similarity,
                time: time
            });
        }
        
        // 相互作用の事後的な分類（観察のため）
        classifyInteraction(exchangeDirection, similarity, efficiencyDiff) {
            // 交換の方向と強さから相互作用を分類
            const absExchange = Math.abs(exchangeDirection);
            
            if (absExchange < 0.1) {
                return 'neutral';  // ほとんど相互作用なし
            } else if (similarity > 0.6 && Math.sign(exchangeDirection) === -Math.sign(efficiencyDiff)) {
                return 'cooperation';  // 効率差を補完するような交換
            } else if (Math.sign(exchangeDirection) === Math.sign(efficiencyDiff)) {
                return 'parasitism';  // 効率差を拡大するような交換
            } else {
                return 'competition';  // その他の競争的な交換
            }
        }
        
        // 遺伝的類似度を計算
        calculateGeneticSimilarity(other) {
            if (!this.genome || !other.genome) return 0;
            
            const mySequence = this.genome.sequence;
            const otherSequence = other.genome.sequence;
            
            // RGBの各要素（24ビットずつ）で類似度を計算
            const rSimilarity = this.calculateSegmentSimilarity(
                mySequence.slice(0, 24),
                otherSequence.slice(0, 24)
            );
            const gSimilarity = this.calculateSegmentSimilarity(
                mySequence.slice(24, 48),
                otherSequence.slice(24, 48)
            );
            const bSimilarity = this.calculateSegmentSimilarity(
                mySequence.slice(48, 72),
                otherSequence.slice(48, 72)
            );
            
            // RGB値の類似度の平均を返す
            return (rSimilarity + gSimilarity + bSimilarity) / 3;
        }
        
        // 24ビットセグメント間の類似度を計算
        calculateSegmentSimilarity(segment1, segment2) {
            // 各セグメントの数値を計算
            const value1 = this.binaryToValue(segment1);
            const value2 = this.binaryToValue(segment2);
            
            // 値の差の絶対値を取り、類似度に変換（1に近いほど類似）
            return 1 - Math.abs(value1 - value2);
        }
        
        // 遺伝的類似度に基づく相互作用係数を計算
        calculateInteractionFactor(other) {
            const similarity = this.calculateGeneticSimilarity(other);
            
            // 協力・競争・寄生の閾値
            const COOPERATION_THRESHOLD = 0.8;  // 高い類似度で協力
            const COMPETITION_THRESHOLD = 0.4;  // 中程度の類似度で競争
            // 低い類似度（0.4未満）で寄生の可能性
            
            if (similarity >= COOPERATION_THRESHOLD) {
                // 協力: エネルギー交換が双方向に可能
                return {
                    type: 'cooperation',
                    factor: (similarity - COOPERATION_THRESHOLD) * 2
                };
            } else if (similarity >= COMPETITION_THRESHOLD) {
                // 競争: 相互に忌避
                return {
                    type: 'competition',
                    factor: -(similarity - COMPETITION_THRESHOLD)
                };
            } else {
                // 寄生: エネルギー交換が一方向に
                return {
                    type: 'parasitism',
                    factor: (COMPETITION_THRESHOLD - similarity) * 1.5
                };
            }
        }
        
        // Entityクラスに追加するメソッド
        reactToEntities() {
            if (!this.memory.sensedEntities || this.memory.sensedEntities.length === 0) return { x: 0, y: 0, z: 0 };
            
            const forces = { x: 0, y: 0, z: 0 };
            
            // 過去の相互作用の記憶を分析
            const recentInteractions = (this.memory.interactions || [])
                .filter(i => time - i.time < 50); // 最近の相互作用のみ考慮
            
            // 各実体に対する態度を決定
            for (const sensed of this.memory.sensedEntities) {
                const other = sensed.entity;
                
                // この実体との過去の相互作用
                const interactionsWithThis = recentInteractions
                    .filter(i => i.target === other);
                
                // 過去の相互作用に基づく態度（-1: 回避、0: 中立、1: 接近）
                let attitude = 0;
                
                if (interactionsWithThis.length > 0) {
                    // 得たエネルギーと失ったエネルギーの合計
                    const gainedEnergy = interactionsWithThis
                        .filter(i => i.type === 'gain')
                        .reduce((sum, i) => sum + i.amount, 0);
                        
                    const lostEnergy = interactionsWithThis
                        .filter(i => i.type === 'give')
                        .reduce((sum, i) => sum + i.amount, 0);
                        
                    // 純利益に基づく態度
                    const netGain = gainedEnergy - lostEnergy;
                    attitude = netGain > 0 ? 1 : (netGain < 0 ? -1 : 0);
                } else {
                    // 過去の相互作用がない場合、エネルギーレベルに基づく判断
                    attitude = this.energy < 0.3 ? 1 : (sensed.perceivedEnergy > this.energy ? -1 : 0);
                }
                
                // 態度に基づく力の計算
                const forceMagnitude = 0.02 * this.attributes.responseRate;
                
                if (attitude > 0) {
                    // 接近（捕食または協力の可能性）
                    forces.x += sensed.direction.x * forceMagnitude;
                    forces.y += sensed.direction.y * forceMagnitude;
                    forces.z += sensed.direction.z * forceMagnitude;
                } else if (attitude < 0) {
                    // 回避（危険または競争相手）
                    forces.x -= sensed.direction.x * forceMagnitude;
                    forces.y -= sensed.direction.y * forceMagnitude;
                    forces.z -= sensed.direction.z * forceMagnitude;
                }
            }
            
            return forces;
        }
        
        // バイナリ遺伝子を生成するメソッド
        generateRandomGenome() {
            const genomeLength = 120; // 各属性に24ビット割り当て（5属性 × 24ビット）
            const sequence = [];
            
            for (let i = 0; i < genomeLength; i++) {
                sequence.push(Math.random() < 0.5 ? 0 : 1);
            }
            
            return sequence;
        }
        
        // 属性をバイナリ遺伝子にエンコードするメソッド
        encodeAttributes(attributes) {
            const sequence = [];
            const attributeKeys = [
                'sensorSensitivity', 
                'energyConversion', 
                'movementEfficiency', 
                'responseRate', 
                'structuralIntegrity'
            ];
            
            // 各属性を24ビットのバイナリに変換
            for (const key of attributeKeys) {
                const value = attributes[key];
                const binaryValue = this.valueToBinary(value, 24);
                sequence.push(...binaryValue);
            }
            
            return sequence;
        }
        
        // 数値を指定ビット数のバイナリ配列に変換
        valueToBinary(value, bits) {
            const binaryArray = [];
            // 0-1の値を0-2^bits-1の整数に変換
            const intValue = Math.floor(value * ((1 << bits) - 1));
            
            for (let i = 0; i < bits; i++) {
                binaryArray.push((intValue >> i) & 1);
            }
            
            return binaryArray;
        }
        
        // バイナリ遺伝子を属性にデコードするメソッド
        decodeGenome(sequence) {
            const attributes = {};
            const attributeKeys = [
                'sensorSensitivity', 
                'energyConversion', 
                'movementEfficiency', 
                'responseRate', 
                'structuralIntegrity'
            ];
            
            // 各24ビットのセグメントを属性値にデコード
            for (let i = 0; i < attributeKeys.length; i++) {
                const start = i * 24;
                const segment = sequence.slice(start, start + 24);
                
                // 遺伝子が機能しているかチェック（例：特定のパターンが必要）
                const isFunctional = this.checkGeneFunctionality(segment);
                
                if (isFunctional) {
                    attributes[attributeKeys[i]] = this.binaryToValue(segment);
                } else {
                    // 機能していない場合は最小値を設定
                    attributes[attributeKeys[i]] = 0.01;
                }
            }
            
            return attributes;
        }
        
        // バイナリ配列を0-1の値に変換
        binaryToValue(binaryArray) {
            let intValue = 0;
            
            for (let i = 0; i < binaryArray.length; i++) {
                intValue |= binaryArray[i] << i;
            }
            
            // 整数値を0-1の範囲に正規化
            return intValue / ((1 << binaryArray.length) - 1);
        }
        
        // 遺伝子が機能しているかをチェック
        checkGeneFunctionality(segment) {
            // 例：開始コドンと終了コドンが正しいかチェック
            const startCodon = segment.slice(0, 3).join('');
            const endCodon = segment.slice(segment.length - 3).join('');
            
            // 開始コドンが"101"で終了コドンが"010"の場合に機能すると仮定
            return startCodon === "101" && endCodon === "010";
            
            // より複雑な条件も可能:
            // - 特定のパターンが必要
            // - 特定の位置のビットが特定の値である必要がある
            // - パリティチェックが成功する必要がある
        }
        
        // 遺伝子の変異を処理するメソッド
        mutateGenome(sequence) {
            const mutatedSequence = [...sequence];
            const genomeLength = sequence.length;
            
            // 1. 点変異（ビットフリップ）- 低確率で各ビットが反転
            for (let i = 0; i < genomeLength; i++) {
                if (Math.random() < 0.005) { // 0.5%の確率で変異
                    mutatedSequence[i] = 1 - mutatedSequence[i]; // 0→1, 1→0
                }
            }
            
            // 2. 挿入変異 - 低確率で新しいビットが挿入される
            if (Math.random() < 0.02 && genomeLength < 200) { // 2%の確率、最大長を制限
                const position = Math.floor(Math.random() * genomeLength);
                const newBit = Math.random() < 0.5 ? 0 : 1;
                mutatedSequence.splice(position, 0, newBit);
                // 長さを調整（最後のビットを削除）
                if (mutatedSequence.length > genomeLength) {
                    mutatedSequence.pop();
                }
            }
            
            // 3. 欠失変異 - 低確率でビットが削除される
            if (Math.random() < 0.02 && genomeLength > 60) { // 2%の確率、最小長を保証
                const position = Math.floor(Math.random() * genomeLength);
                mutatedSequence.splice(position, 1);
                // 長さを調整（末尾にランダムなビットを追加）
                if (mutatedSequence.length < genomeLength) {
                    mutatedSequence.push(Math.random() < 0.5 ? 0 : 1);
                }
            }
            
            // 4. 逆位変異 - 低確率で一部の配列が反転する
            if (Math.random() < 0.01) { // 1%の確率
                const length = Math.floor(Math.random() * 10) + 2; // 2-11ビットの長さ
                const start = Math.floor(Math.random() * (genomeLength - length));
                const segment = mutatedSequence.slice(start, start + length);
                segment.reverse();
                for (let i = 0; i < length; i++) {
                    mutatedSequence[start + i] = segment[i];
                }
            }
            
            // 5. 重複変異 - 低確率で一部の配列が複製される
            if (Math.random() < 0.01 && genomeLength < 180) { // 1%の確率、最大長を制限
                const length = Math.floor(Math.random() * 8) + 2; // 2-9ビットの長さ
                const start = Math.floor(Math.random() * (genomeLength - length));
                const segment = mutatedSequence.slice(start, start + length);
                const insertPosition = Math.floor(Math.random() * genomeLength);
                
                // 複製したセグメントを挿入
                mutatedSequence.splice(insertPosition, 0, ...segment);
                
                // 長さを調整（末尾から超過分を削除）
                if (mutatedSequence.length > genomeLength) {
                    mutatedSequence.splice(genomeLength, mutatedSequence.length - genomeLength);
                }
            }
            
            return mutatedSequence;
        }
    }
    
    // 環境クラス - エネルギー場や環境条件を提供
    class Environment {
        constructor() {
            // 環境のノイズシード
            this.seedX = Math.random() * 1000;
            this.seedY = Math.random() * 1000;
            this.seedZ = Math.random() * 1000;
            
            // 環境エネルギーフィールドの初期化
            this.energyField = new Array(width * height);
            
            // 初期エネルギー分布の設定
            let totalEntityEnergy = 0;
            for (const entity of entities) {
                totalEntityEnergy += entity.energy;
            }
            
            // 残りのエネルギーを環境に分配
            const environmentEnergy = TOTAL_SYSTEM_ENERGY - totalEntityEnergy;
            this.initializeEnergyField(environmentEnergy);
        }
        
        // 環境エネルギーフィールドの初期化
        initializeEnergyField(totalEnvironmentEnergy) {
            let totalDistributionWeight = 0;
            
            // 初期分布の重みを計算
            for (let i = 0; i < this.energyField.length; i++) {
                const x = i % width;
                const y = Math.floor(i / width);
                
                // 単純なノイズ関数でエネルギー分布の重みを決定
                const nx = (x * 0.05 + this.seedX);
                const ny = (y * 0.05 + this.seedY);
                // より対称的な分布を生成
                const weight = (Math.sin(nx) * Math.sin(ny) + 1) / 2;  // 0～1の範囲
                
                this.energyField[i] = {
                    energy: 0,
                    weight: weight
                };
                
                totalDistributionWeight += weight;
            }
            
            // 重みに基づいてエネルギーを分配
            for (let i = 0; i < this.energyField.length; i++) {
                this.energyField[i].energy = 
                    (this.energyField[i].weight / totalDistributionWeight) * totalEnvironmentEnergy;
            }
        }
        
        // 指定位置でのエネルギー量を取得し、その分環境から減少させる
        getEnergyAt(position, time, amount) {
            const x = Math.floor(position.x);
            const y = Math.floor(position.y);
            
            // 範囲外チェック
            if (x < 0 || x >= width || y < 0 || y >= height) return 0;
            
            const index = y * width + x;
            const availableEnergy = this.energyField[index].energy;
            
            // 要求量と利用可能量の小さい方を取得
            const extractedEnergy = Math.min(amount, availableEnergy);
            
            // 環境からエネルギーを減少
            this.energyField[index].energy -= extractedEnergy;
            
            return extractedEnergy;
        }
        
        // エネルギーを環境に戻す
        returnEnergyAt(position, amount) {
            const x = Math.floor(position.x);
            const y = Math.floor(position.y);
            
            // 範囲外チェック
            if (x < 0 || x >= width || y < 0 || y >= height) return;
            
            const index = y * width + x;
            this.energyField[index].energy += amount;
        }
        
        // エネルギーの拡散（各フレームで呼び出す）
        diffuseEnergy() {
            const diffusionRate = 0.05;
            const newField = [...this.energyField];
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const index = y * width + x;
                    const currentEnergy = this.energyField[index].energy;
                    
                    // 拡散するエネルギー量
                    const diffusionAmount = currentEnergy * diffusionRate;
                    
                    // 自身は拡散分減少
                    newField[index].energy -= diffusionAmount;
                    
                    // 隣接セルに拡散（4方向）
                    const directions = [
                        {dx: 1, dy: 0}, {dx: -1, dy: 0},
                        {dx: 0, dy: 1}, {dx: 0, dy: -1}
                    ];
                    
                    for (const dir of directions) {
                        const nx = x + dir.dx;
                        const ny = y + dir.dy;
                        
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const neighborIndex = ny * width + nx;
                            newField[neighborIndex].energy += diffusionAmount / 4;
                        }
                    }
                }
            }
            
            this.energyField = newField;
        }
    }
    
    // エンティティと環境の初期化
    const entities = [];
    const environment = new Environment();
    
    // コロニー状の初期配置を行う関数
    function createInitialColony() {
        // コロニーの中心位置（画面中央）
        const centerX = width * 0.5;
        const centerY = height * 0.5;
        
        // コロニーのサイズ
        const colonyRadius = 5;
        
        // 大腸菌型の初期生命の属性
        const bacterialAttributes = {
            sensorSensitivity: 0.3,     // 単純な化学走性のみ
            energyConversion: 0.8,      // 高いエネルギー変換効率
            movementEfficiency: 0.7,    // 効率的な運動能力
            responseRate: 0.4,          // 単純な応答
            structuralIntegrity: 0.6    // 適度な構造強度
        };
        
        // 密集度を調整しながらエンティティを配置
        for (let i = 0; i < initialEntityCount; i++) {
            // 極座標でランダムな位置を生成
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * colonyRadius;
            
            // 極座標から直交座標に変換
            const offsetX = Math.cos(angle) * radius;
            const offsetY = Math.sin(angle) * radius;
            
            // 最終位置の計算
            const x = centerX + offsetX;
            const y = centerY + offsetY;
            const z = Math.random() * 4 - 2;  // Z軸方向の分散を抑制
            
            // エンティティの作成と追加
            entities.push(new Entity(x, y, z, bacterialAttributes));
        }
    }
    
    // 初期コロニーの作成
    createInitialColony();
    
    // Z-bufferの初期化（表示用）
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
    
    // エンティティの色を計算
    function getEntityColor(entity) {
        // 遺伝子の特徴を色に反映
        const genome = entity.genome.sequence;
        
        // RGBの各要素に24ビットずつ割り当て
        const rSegment = genome.slice(0, 24);
        const gSegment = genome.slice(24, 48);
        const bSegment = genome.slice(48, 72);
        
        // バイナリ配列を16進数に変換
        const r = Math.floor(entity.binaryToValue(rSegment) * 255);
        const g = Math.floor(entity.binaryToValue(gSegment) * 255);
        const b = Math.floor(entity.binaryToValue(bSegment) * 255);
        
        // エネルギーレベルをアルファ値として使用
        const alpha = 0.3 + entity.energy * 0.7;
        
        // RGBA形式で返す
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    // フレームの描画
    function render() {
        const zBuffer = initZBuffer();
        
        // 現在の実時間を取得
        const realTime = performance.now() / 1000;  // 秒単位の実時間
        
        // エンティティの更新
        for (let i = entities.length - 1; i >= 0; i--) {
            // 各エンティティの主観的時間スケールを計算
            const subjectiveTimeScale = calculateSubjectiveTime(entities[i], realTime);
            
            // 主観的時間スケールを使用してエンティティを更新
            entities[i].update(entities, environment, subjectiveTimeScale);
            
            if (!entities[i].isActive) {
                // 不活性エンティティの除去のみ（再生なし）
                entities.splice(i, 1);
            }
        }
        
        // エンティティの描画
        for (const entity of entities) {
            const projectedX = Math.floor(entity.position.x);
            const projectedY = Math.floor(entity.position.y);
            const z = entity.position.z;
            
            if (projectedX >= 0 && projectedX < width && projectedY >= 0 && projectedY < height) {
                const bufferIndex = projectedY * width + projectedX;
                
                if (z < zBuffer[bufferIndex].depth) {
                    // 密度とエネルギーに基づく文字選択
                    const charIndex = Math.floor((entity.density * entity.energy) * (asciiChars.length - 1));
                    const displayChar = asciiChars[Math.min(Math.max(0, charIndex), asciiChars.length - 1)];
                    
                    zBuffer[bufferIndex] = {
                        char: displayChar,
                        depth: z,
                        color: getEntityColor(entity)
                    };
                }
            }
        }
        
        // Z-bufferから文字列を生成して描画
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
        
        canvas.innerHTML = output;
        
        // 次のフレーム
        time++;
        
        // 環境のエネルギー拡散
        environment.diffuseEnergy();
        
        // エネルギー保存の検証（デバッグ用）
        if (time % 100 === 0) {
            let totalEnergy = 0;
            
            // エンティティのエネルギー
            for (const entity of entities) {
                totalEnergy += entity.energy;
            }
            
            // 環境のエネルギー
            for (const cell of environment.energyField) {
                totalEnergy += cell.energy;
            }
            
            console.log(`Time: ${time}, Total Energy: ${totalEnergy}, Target: ${TOTAL_SYSTEM_ENERGY}`);
        }
        
        // 10FPSに制限
        setTimeout(() => {
        requestAnimationFrame(render);
        }, 33); // 100ms = 10FPS
    }
    
    // エンティティごとの主観的時間を計算 - 昼夜サイクル要素なし
    function calculateSubjectiveTime(entity, realTime) {
        // エネルギーレベルに基づく時間スケールの変化
        const energyTimeFactor = 0.5 + entity.energy;
        
        // 属性に基づく時間知覚の違い
        const perceptionFactor = entity.attributes.sensorSensitivity * 0.5 + 0.5;
        
        // 環境の密度に基づく時間の歪み（例：深さによる）
        const depthDistortion = Math.abs(entity.position.z) / 10;
        
        // 実時間と内部時間のギャップに基づく係数
        const timeGapFactor = Math.sin(realTime * 0.1) * 0.2 + 1.0;
        
        // 最終的な主観的時間スケール（昼夜サイクル要素なし）
        return energyTimeFactor * perceptionFactor * (1 - depthDistortion * 0.5) * timeGapFactor;
    }
    
    // シミュレーション開始
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
}); 