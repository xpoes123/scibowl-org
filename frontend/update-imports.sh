#!/bin/bash

# Update imports in practice feature files
find src/features/practice -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  -e "s|from '../types/api'|from '../../../shared/types/api'|g" \
  -e "s|from '../utils/keyboardUtils'|from '../../../shared/utils/keyboardUtils'|g" \
  -e "s|from '../utils/answerUtils'|from '../../../shared/utils/answerUtils'|g" \
  -e "s|from './IdentifyAll'|from '../../questions/components/IdentifyAll'|g" \
  -e "s|from './Rank'|from '../../questions/components/Rank'|g" \
  {} \;

# Update imports in questions feature files
find src/features/questions -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  -e "s|from '../types/api'|from '../../../shared/types/api'|g" \
  -e "s|from '../services/api'|from '../../../core/api/api'|g" \
  {} \;

# Update imports in auth feature files
find src/features/auth -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  -e "s|from '../types/api'|from '../../../shared/types/api'|g" \
  -e "s|from '../services/api'|from '../../../core/api/api'|g" \
  {} \;

# Update imports in profile feature files
find src/features/profile -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  -e "s|from '../types/api'|from '../../../shared/types/api'|g" \
  -e "s|from '../services/api'|from '../../../core/api/api'|g" \
  {} \;

echo "Import paths updated successfully!"
